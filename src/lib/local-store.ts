import { useSyncExternalStore } from 'react';
import type { Student } from './students';

// All app data lives only in this browser (localStorage). Nothing is sent to a
// server: no account, no database. Clearing the browser's site data erases it.

export type Roster = { students: Student[]; sourceFile: string | null; savedAt: string | null };
export type Race = { id: string; title: string; distance: string; started_at: string | null; ended_at: string | null; created_at: string };
export type Finish = { id: string; race_id: string; position: number; elapsed_ms: number; bib: string | null };

export type LocalData = { version: 1; roster: Roster; races: Race[]; finishes: Finish[] };

const KEY = 'cross-college:data:v1';
const EVENT = 'cross-college-data-changed';
const EMPTY: LocalData = { version: 1, roster: { students: [], sourceFile: null, savedAt: null }, races: [], finishes: [] };

let cache: LocalData | null = null;

function parse(raw: string | null): LocalData | null {
  if (!raw) return null;
  try {
    const data = JSON.parse(raw) as Partial<LocalData>;
    return {
      version: 1,
      roster: { ...EMPTY.roster, ...(data.roster ?? {}) },
      races: Array.isArray(data.races) ? data.races : [],
      finishes: Array.isArray(data.finishes) ? data.finishes : [],
    };
  } catch { return null; }
}

// One-time recovery of the copy the previous (online) version kept on this
// computer, then removal of every leftover of the old account system.
function migrateLegacy(): LocalData | null {
  let best: { savedAt: string; data: LocalData } | null = null;
  const legacyKeys: string[] = [];
  for (let i = 0; i < window.localStorage.length; i++) {
    const key = window.localStorage.key(i);
    if (!key) continue;
    if (key.startsWith('sb-') || key.startsWith('cross-offline:')) legacyKeys.push(key);
    if (!key.startsWith('cross-offline:')) continue;
    try {
      const snap = JSON.parse(window.localStorage.getItem(key) ?? '') as {
        savedAt?: string; roster?: Roster | null; races?: Race[]; finishes?: Record<string, Finish[]>;
      };
      const data: LocalData = {
        version: 1,
        roster: snap.roster ?? EMPTY.roster,
        races: snap.races ?? [],
        finishes: Object.values(snap.finishes ?? {}).flat(),
      };
      if (!best || (snap.savedAt ?? '') > best.savedAt) best = { savedAt: snap.savedAt ?? '', data };
    } catch { /* ignore unreadable snapshot */ }
  }
  legacyKeys.forEach(key => window.localStorage.removeItem(key));
  return best?.data ?? null;
}

function read(): LocalData {
  if (cache) return cache;
  let data = parse(window.localStorage.getItem(KEY));
  if (!data) {
    data = migrateLegacy() ?? EMPTY;
    persist(data);
  }
  cache = data;
  return data;
}

function persist(data: LocalData) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(data));
  } catch {
    throw new Error('Le navigateur refuse d’enregistrer les données (espace plein ou navigation privée).');
  }
}

function write(update: (data: LocalData) => LocalData) {
  const next = update(read());
  persist(next);
  cache = next;
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key !== KEY) return;
    cache = null; // another tab changed the data
    onChange();
  };
  window.addEventListener(EVENT, onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener('storage', onStorage);
  };
}

/** Local data, or null during server rendering / before hydration. */
export function useLocalData(): LocalData | null {
  return useSyncExternalStore(subscribe, read, () => null);
}

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `id-${Date.now()}-${Math.random().toString(36).slice(2)}`;

// ---- Roster ---------------------------------------------------------------

export function saveRoster(students: Student[], sourceFile: string | null) {
  const sorted = [...students].sort((a, b) => Number(a.bib) - Number(b.bib));
  write(d => ({ ...d, roster: { students: sorted, sourceFile, savedAt: new Date().toISOString() } }));
  return sorted.length;
}

export function clearRoster() {
  write(d => ({ ...d, roster: { students: [], sourceFile: null, savedAt: null } }));
}

// ---- Races ----------------------------------------------------------------

export function createRace(): Race {
  const race: Race = { id: newId(), title: '', distance: '', started_at: null, ended_at: null, created_at: new Date().toISOString() };
  write(d => ({ ...d, races: [race, ...d.races] }));
  return race;
}

export function updateRace(id: string, patch: Partial<Omit<Race, 'id'>>) {
  write(d => ({ ...d, races: d.races.map(r => (r.id === id ? { ...r, ...patch } : r)) }));
}

export function deleteRace(id: string) {
  write(d => ({ ...d, races: d.races.filter(r => r.id !== id), finishes: d.finishes.filter(f => f.race_id !== id) }));
}

export const racesOf = (data: LocalData | null) =>
  [...(data?.races ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at));

// ---- Finishes -------------------------------------------------------------

export const finishesOf = (data: LocalData | null, raceId: string | undefined) =>
  raceId ? (data?.finishes ?? []).filter(f => f.race_id === raceId).sort((a, b) => a.position - b.position) : [];

export function addFinish(raceId: string, elapsedMs: number): Finish {
  let finish!: Finish;
  write(d => {
    const last = d.finishes.reduce((max, f) => (f.race_id === raceId ? Math.max(max, f.position) : max), 0);
    finish = { id: newId(), race_id: raceId, position: last + 1, elapsed_ms: elapsedMs, bib: null };
    return { ...d, finishes: [...d.finishes, finish] };
  });
  return finish;
}

export function setFinishBib(id: string, bib: string | null) {
  write(d => ({ ...d, finishes: d.finishes.map(f => (f.id === id ? { ...f, bib } : f)) }));
}

export function removeFinish(id: string) {
  write(d => ({ ...d, finishes: d.finishes.filter(f => f.id !== id) }));
}
