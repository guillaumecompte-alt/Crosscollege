import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import type { Roster } from './roster.functions';

// Offline layer: the last loaded roster, races and arrivals are kept on this
// computer (localStorage, one snapshot per signed-in account) so the app stays
// readable and exportable without a network. Writes made offline are queued in
// the snapshot and replayed in order when the connection comes back.

export type OfflineRace = { id: string; title: string; distance: string; started_at: string | null; ended_at: string | null; created_at: string };
export type OfflineFinish = { id: string; race_id: string; position: number; elapsed_ms: number; bib: string | null };

export type PendingOp =
  | { kind: 'race.insert'; race: OfflineRace }
  | { kind: 'race.update'; id: string; patch: Partial<OfflineRace> }
  | { kind: 'race.delete'; id: string }
  | { kind: 'finish.insert'; finish: OfflineFinish }
  | { kind: 'finish.update'; id: string; race_id: string; bib: string | null }
  | { kind: 'finish.delete'; id: string; race_id: string };

export type OfflineSnapshot = {
  savedAt: string;
  roster: Roster | null;
  races: OfflineRace[];
  finishes: Record<string, OfflineFinish[]>;
  pending: PendingOp[];
};

const EMPTY: OfflineSnapshot = { savedAt: '', roster: null, races: [], finishes: {}, pending: [] };
export const OFFLINE_EVENT = 'cross-offline-changed';
const storageKey = (userId: string) => `cross-offline:${userId}`;

const online = () => typeof navigator === 'undefined' || navigator.onLine;

function readSnapshot(userId: string): OfflineSnapshot {
  if (typeof window === 'undefined') return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    return raw ? { ...EMPTY, ...(JSON.parse(raw) as OfflineSnapshot) } : EMPTY;
  } catch { return EMPTY; }
}

function writeSnapshot(userId: string, snapshot: OfflineSnapshot) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(storageKey(userId), JSON.stringify(snapshot)); } catch { /* quota exceeded: keep the app usable */ }
  window.dispatchEvent(new Event(OFFLINE_EVENT));
}

export function loadSnapshot(userId: string): OfflineSnapshot {
  return readSnapshot(userId);
}

export function cacheSnapshot(userId: string, patch: Partial<Pick<OfflineSnapshot, 'roster' | 'races' | 'finishes'>>) {
  const snap = readSnapshot(userId);
  writeSnapshot(userId, { ...snap, ...patch, savedAt: new Date().toISOString() });
}

export function queueOp(userId: string, op: PendingOp) {
  const snap = readSnapshot(userId);
  writeSnapshot(userId, { ...snap, pending: [...snap.pending, op] });
}

export function upsertLocalRace(userId: string, race: OfflineRace) {
  const snap = readSnapshot(userId);
  const races = snap.races.some(r => r.id === race.id)
    ? snap.races.map(r => (r.id === race.id ? race : r))
    : [race, ...snap.races];
  cacheSnapshot(userId, { races });
}

export function patchLocalRace(userId: string, id: string, patch: Partial<OfflineRace>) {
  const snap = readSnapshot(userId);
  cacheSnapshot(userId, { races: snap.races.map(r => (r.id === id ? { ...r, ...patch } : r)) });
}

export function removeLocalRace(userId: string, raceId: string) {
  const snap = readSnapshot(userId);
  const finishes = { ...snap.finishes };
  delete finishes[raceId];
  const pending = snap.pending.filter(op => {
    if (op.kind === 'race.insert' || op.kind === 'race.update' || op.kind === 'race.delete') {
      return (op.kind === 'race.insert' ? op.race.id : op.id) !== raceId;
    }
    if (op.kind === 'finish.insert') return op.finish.race_id !== raceId;
    return op.race_id !== raceId;
  });
  writeSnapshot(userId, { ...snap, races: snap.races.filter(r => r.id !== raceId), finishes, pending, savedAt: new Date().toISOString() });
}

export function upsertLocalFinish(userId: string, finish: OfflineFinish) {
  const snap = readSnapshot(userId);
  const list = snap.finishes[finish.race_id] ?? [];
  const finishes = {
    ...snap.finishes,
    [finish.race_id]: list.some(f => f.id === finish.id) ? list.map(f => (f.id === finish.id ? finish : f)) : [...list, finish],
  };
  cacheSnapshot(userId, { finishes });
}

export function patchLocalFinish(userId: string, id: string, bib: string | null) {
  const snap = readSnapshot(userId);
  const finishes: Record<string, OfflineFinish[]> = {};
  for (const [raceId, list] of Object.entries(snap.finishes)) {
    finishes[raceId] = list.map(f => (f.id === id ? { ...f, bib } : f));
  }
  cacheSnapshot(userId, { finishes });
}

export function removeLocalFinish(userId: string, finishId: string) {
  const snap = readSnapshot(userId);
  const finishes: Record<string, OfflineFinish[]> = {};
  for (const [raceId, list] of Object.entries(snap.finishes)) {
    finishes[raceId] = list.filter(f => f.id !== finishId);
  }
  const pending = snap.pending.filter(op => !(op.kind === 'finish.insert' && op.finish.id === finishId));
  writeSnapshot(userId, { ...snap, finishes, pending, savedAt: new Date().toISOString() });
}

export function isPendingRow(userId: string, kind: 'race' | 'finish', id: string): boolean {
  const snap = readSnapshot(userId);
  return snap.pending.some(op => {
    if (kind === 'race') {
      const opId = op.kind === 'race.insert' ? op.race.id : op.kind === 'race.update' || op.kind === 'race.delete' ? op.id : undefined;
      return opId === id;
    }
    if (op.kind === 'finish.insert') return op.finish.id === id;
    if (op.kind === 'finish.update' || op.kind === 'finish.delete') return op.id === id;
    return false;
  });
}

// True when the server write actually failed because of the network (and not
// because the database refused it) — only then do we keep the change locally.
export function isNetworkError(error: unknown): boolean {
  if (!online()) return true;
  const message = error instanceof Error
    ? error.message
    : typeof error === 'object' && error ? String((error as { message?: unknown }).message ?? error) : String(error ?? '');
  return /failed to fetch|network ?error|networkerror|fetch failed|load failed|failed to parse url/i.test(message);
}

// A row waiting in the queue must never be written directly: the server does
// not know it yet. It goes through the queue so operations replay in order.
function mustQueue(userId: string): boolean {
  return !online() || readSnapshot(userId).pending.length > 0;
}

async function applyOp(op: PendingOp) {
  if (op.kind === 'race.insert') {
    const { error } = await supabase.from('races').upsert(op.race);
    if (error) throw error;
  } else if (op.kind === 'race.update') {
    const { error } = await supabase.from('races').update(op.patch).eq('id', op.id);
    if (error) throw error;
  } else if (op.kind === 'race.delete') {
    const { error } = await supabase.from('races').delete().eq('id', op.id);
    if (error) throw error;
  } else if (op.kind === 'finish.insert') {
    const { error } = await supabase.from('finishes').upsert(op.finish);
    if (error) throw error;
  } else if (op.kind === 'finish.update') {
    const { error } = await supabase.from('finishes').update({ bib: op.bib }).eq('id', op.id);
    if (error) throw error;
  } else {
    const { error } = await supabase.from('finishes').delete().eq('id', op.id);
    if (error) throw error;
  }
}

export async function flushQueue(userId: string): Promise<{ synced: number; remaining: number }> {
  const snap = readSnapshot(userId);
  if (!snap.pending.length) return { synced: 0, remaining: 0 };
  const remaining: PendingOp[] = [];
  let synced = 0;
  for (const [i, op] of snap.pending.entries()) {
    try {
      await applyOp(op);
      synced++;
    } catch {
      remaining.push(...snap.pending.slice(i));
      break;
    }
  }
  writeSnapshot(userId, { ...snap, pending: remaining, savedAt: new Date().toISOString() });
  return { synced, remaining: remaining.length };
}

// ---- Read helpers: server first, snapshot when offline --------------------

export async function fetchRosterWithCache(userId: string, onlineFetch: () => Promise<Roster>): Promise<Roster> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const cached = readSnapshot(userId).roster;
    if (cached) return cached;
  }
  try {
    const roster = await onlineFetch();
    cacheSnapshot(userId, { roster });
    return roster;
  } catch (error) {
    if (isNetworkError(error)) {
      const cached = readSnapshot(userId).roster;
      if (cached) return cached;
    }
    throw error;
  }
}

export async function fetchRacesWithCache(userId: string): Promise<OfflineRace[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return readSnapshot(userId).races;
  const { data, error } = await supabase.from('races').select('*').order('created_at', { ascending: false });
  if (error && !isNetworkError(error)) throw error;

  const snap = readSnapshot(userId);
  if (error || !data) return snap.races;

  // Keep offline-created races and offline deletions visible until the queue
  // has been replayed, so the list never flickers between two worlds.
  const deleted = new Set(snap.pending.filter(op => op.kind === 'race.delete').map(op => op.id));
  const created = snap.pending.filter(op => op.kind === 'race.insert').map(op => op.race).filter(r => !data.some(d => d.id === r.id));
  const races = [...(data as OfflineRace[]).filter(r => !deleted.has(r.id)), ...created];
  cacheSnapshot(userId, { races });
  return races;
}

export async function fetchFinishesWithCache(userId: string, raceId: string): Promise<OfflineFinish[]> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) return readSnapshot(userId).finishes[raceId] ?? [];
  const { data, error } = await supabase.from('finishes').select('*').eq('race_id', raceId).order('position');
  if (error && !isNetworkError(error)) throw error;

  const snap = readSnapshot(userId);
  if (error || !data) return snap.finishes[raceId] ?? [];

  const deleted = new Set(snap.pending.flatMap(op => (op.kind === 'finish.delete' && op.race_id === raceId ? [op.id] : [])));
  const updated = new Map(snap.pending.flatMap(op => (op.kind === 'finish.update' && op.race_id === raceId ? [[op.id, op.bib] as const] : [])));
  const inserted = snap.pending
    .flatMap(op => (op.kind === 'finish.insert' && op.finish.race_id === raceId ? [op.finish] : []))
    .filter(f => !data.some(d => d.id === f.id));
  const finishes = [
    ...(data as OfflineFinish[]).filter(f => !deleted.has(f.id)).map(f => ({ ...f, bib: updated.has(f.id) ? updated.get(f.id)! : f.bib })),
    ...inserted,
  ];
  cacheSnapshot(userId, { finishes: { ...snap.finishes, [raceId]: finishes } });
  return finishes;
}

// ---- Hook: banner state + background replay of the queue ------------------

export function useOfflineSync(userId: string | undefined) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState({ online: true, pending: 0 });

  useEffect(() => {
    const update = () => setStatus({ online: online(), pending: userId ? readSnapshot(userId).pending.length : 0 });
    const replay = () => {
      if (!userId) return;
      void flushQueue(userId).then(({ synced }) => {
        if (!synced) return;
        toast.success(synced === 1 ? '1 modification synchronisée.' : `${synced} modifications synchronisées.`);
        void queryClient.invalidateQueries();
      });
    };
    const onOnline = () => { update(); replay(); };
    update();
    if (userId && online() && readSnapshot(userId).pending.length) replay();
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', update);
    window.addEventListener(OFFLINE_EVENT, update);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', update);
      window.removeEventListener(OFFLINE_EVENT, update);
    };
  }, [userId, queryClient]);

  return status;
}

export function newOfflineId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `off-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
