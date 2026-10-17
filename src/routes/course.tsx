import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, Flag, LoaderCircle, Play, Plus, Square, Trash2, UserCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthPanel } from '@/components/auth-panel';
import { AppHeader } from '@/components/app-header';
import { OfflineBanner } from '@/components/offline-banner';
import { useAuth } from '@/hooks/useAuth';
import { getRoster } from '@/lib/roster.functions';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchFinishesWithCache, fetchRacesWithCache, fetchRosterWithCache, isNetworkError, isPendingRow,
  newOfflineId, patchLocalFinish, patchLocalRace, queueOp, removeLocalFinish, removeLocalRace,
  upsertLocalFinish, upsertLocalRace, useOfflineSync,
  type OfflineFinish, type OfflineRace,
} from '@/lib/offline';

export const Route = createFileRoute('/course')({
  head: () => ({ meta: [
    { title: 'Course · Cross du collège' },
    { name: 'description', content: 'Chronométrez le cross du collège et enregistrez l’ordre d’arrivée des coureurs.' },
    { property: 'og:title', content: 'Course · Cross du collège' },
    { property: 'og:description', content: 'Départ, arrivées et temps de chaque coureur du cross.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: CoursePage,
});

export const formatTime = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 100));
  const tenths = total % 10, s = Math.floor(total / 10) % 60, m = Math.floor(total / 600) % 60, h = Math.floor(total / 36000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${h ? `${h}:` : ''}${pad(m)}:${pad(s)}.${tenths}`;
};

function CoursePage() {
  const { session, loading } = useAuth();
  const qc = useQueryClient();
  const uid = session?.user.id;
  useOfflineSync(uid);
  const fetchRoster = useServerFn(getRoster);
  const roster = useQuery({
    queryKey: ['roster', uid ?? 'anon'], enabled: !!session,
    queryFn: () => fetchRosterWithCache(uid!, () => fetchRoster()),
  });
  const races = useQuery({
    queryKey: ['races', uid], enabled: !!session,
    queryFn: () => fetchRacesWithCache(uid!),
  });
  const [raceId, setRaceId] = useState<string | null>(null);
  const race = races.data?.find(r => r.id === raceId) ?? races.data?.[0];
  const finishes = useQuery({
    queryKey: ['finishes', race?.id], enabled: !!race,
    queryFn: () => fetchFinishesWithCache(uid!, race!.id),
  });
  const [now, setNow] = useState(Date.now());
  const [title, setTitle] = useState('');
  const [distance, setDistance] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => { setTitle(race?.title ?? ''); setDistance(race?.distance ?? ''); }, [race?.id]);
  const running = !!race?.started_at && !race.ended_at;
  useEffect(() => { if (!running) return; const t = setInterval(() => setNow(Date.now()), 100); return () => clearInterval(t); }, [running]);

  const byBib = useMemo(() => new Map((roster.data?.students ?? []).map(s => [s.bib.replace(/^0+(?=\d)/, ''), s])), [roster.data]);
  const find = (bib: string | null) => (bib ? byBib.get(bib.trim().replace(/^0+(?=\d)/, '')) : undefined);
  const list = finishes.data ?? [];
  const bibCount = useMemo(() => { const m = new Map<string, number>(); list.forEach(f => { if (f.bib) { const k = f.bib.replace(/^0+(?=\d)/, ''); m.set(k, (m.get(k) ?? 0) + 1); } }); return m; }, [list]);

  const elapsed = race?.started_at ? (race.ended_at ? Date.parse(race.ended_at) : now) - Date.parse(race.started_at) : 0;
  const setRaces = (updater: (old: OfflineRace[]) => OfflineRace[]) => qc.setQueryData<OfflineRace[]>(['races', uid], old => updater(old ?? []));
  const setFinishList = (rid: string, updater: (old: OfflineFinish[]) => OfflineFinish[]) => qc.setQueryData<OfflineFinish[]>(['finishes', rid], old => updater(old ?? []));
  const refreshRaces = () => qc.invalidateQueries({ queryKey: ['races'] });

  async function newRace() {
    if (!uid || busy) return;
    setBusy(true);
    if (!navigator.onLine) {
      const race: OfflineRace = { id: newOfflineId(), title: '', distance: '', started_at: null, ended_at: null, created_at: new Date().toISOString() };
      queueOp(uid, { kind: 'race.insert', race });
      upsertLocalRace(uid, race);
      setRaces(old => [race, ...old]);
      setBusy(false); setRaceId(race.id);
      toast.info('Hors connexion : course créée sur cet ordinateur. Elle sera synchronisée au retour du réseau.');
      return;
    }
    const { data, error } = await supabase.from('races').insert({ title: '', distance: '' }).select().single();
    setBusy(false);
    if (error) { toast.error('Impossible de créer la course.'); return; }
    await refreshRaces(); setRaceId(data.id);
  }
  async function updateRace(patch: Partial<OfflineRace>) {
    if (!uid || !race) return;
    setRaces(old => old.map(r => (r.id === race.id ? { ...r, ...patch } : r)));
    if (!navigator.onLine || isPendingRow(uid, 'race', race.id)) {
      patchLocalRace(uid, race.id, patch);
      queueOp(uid, { kind: 'race.update', id: race.id, patch });
      toast.info('Hors connexion : modification gardée sur cet ordinateur.');
      return;
    }
    const { error } = await supabase.from('races').update(patch).eq('id', race.id);
    if (error) {
      if (isNetworkError(error)) {
        patchLocalRace(uid, race.id, patch);
        queueOp(uid, { kind: 'race.update', id: race.id, patch });
        toast.info('Hors connexion : modification gardée sur cet ordinateur.');
        return;
      }
      toast.error('Modification non enregistrée.');
      await refreshRaces();
      return;
    }
    patchLocalRace(uid, race.id, patch);
  }
  async function start() { await updateRace({ started_at: new Date().toISOString(), ended_at: null }); }
  async function stop() { if (confirm('Arrêter le chrono ? La course sera terminée.')) await updateRace({ ended_at: new Date().toISOString() }); }
  async function arrival() {
    if (!uid || !race?.started_at) return;
    const ms = Date.now() - Date.parse(race.started_at);
    const position = (list.at(-1)?.position ?? 0) + 1;
    const finish: OfflineFinish = { id: newOfflineId(), race_id: race.id, position, elapsed_ms: ms, bib: null };
    setFinishList(race.id, old => [...old, finish]);
    if (!navigator.onLine || isPendingRow(uid, 'race', race.id) || isPendingRow(uid, 'finish', finish.id)) {
      upsertLocalFinish(uid, finish);
      queueOp(uid, { kind: 'finish.insert', finish });
      return;
    }
    const { error } = await supabase.from('finishes').upsert(finish);
    if (error) {
      if (isNetworkError(error)) {
        upsertLocalFinish(uid, finish);
        queueOp(uid, { kind: 'finish.insert', finish });
        return;
      }
      toast.error('Arrivée non enregistrée, recliquez.');
      setFinishList(race.id, old => old.filter(f => f.id !== finish.id));
      return;
    }
    upsertLocalFinish(uid, finish);
  }
  async function setBib(f: OfflineFinish, bib: string) {
    if (!uid) return;
    const value = bib.trim() || null;
    if (value === f.bib) return;
    setFinishList(f.race_id, old => old.map(x => (x.id === f.id ? { ...x, bib: value } : x)));
    if (!navigator.onLine || isPendingRow(uid, 'finish', f.id)) {
      patchLocalFinish(uid, f.id, value);
      queueOp(uid, { kind: 'finish.update', id: f.id, race_id: f.race_id, bib: value });
      return;
    }
    const { error } = await supabase.from('finishes').update({ bib: value }).eq('id', f.id);
    if (error) {
      if (isNetworkError(error)) {
        patchLocalFinish(uid, f.id, value);
        queueOp(uid, { kind: 'finish.update', id: f.id, race_id: f.race_id, bib: value });
        return;
      }
      toast.error('Dossard non enregistré.');
      return;
    }
    patchLocalFinish(uid, f.id, value);
  }
  async function removeFinish(f: OfflineFinish) {
    if (!uid || !confirm(`Supprimer l’arrivée n°${f.position} ?`)) return;
    setFinishList(f.race_id, old => old.filter(x => x.id !== f.id));
    if (!navigator.onLine || isPendingRow(uid, 'finish', f.id)) {
      removeLocalFinish(uid, f.id);
      queueOp(uid, { kind: 'finish.delete', id: f.id, race_id: f.race_id });
      return;
    }
    const { error } = await supabase.from('finishes').delete().eq('id', f.id);
    if (error && isNetworkError(error)) {
      removeLocalFinish(uid, f.id);
      queueOp(uid, { kind: 'finish.delete', id: f.id, race_id: f.race_id });
      return;
    }
    if (error) { toast.error('Arrivée non supprimée.'); setFinishList(f.race_id, old => [...old, f].sort((a, b) => a.position - b.position)); return; }
    removeLocalFinish(uid, f.id);
  }
  async function deleteRace() {
    if (!uid || !race || !confirm(`Supprimer la course « ${race.title || 'Course sans titre'} » et toutes ses arrivées ? Cette action est définitive.`)) return;
    setBusy(true);
    if (!navigator.onLine || isPendingRow(uid, 'race', race.id)) {
      removeLocalRace(uid, race.id);
      queueOp(uid, { kind: 'race.delete', id: race.id });
      setRaces(old => old.filter(r => r.id !== race.id));
      qc.removeQueries({ queryKey: ['finishes', race.id] });
      setBusy(false); setRaceId(null);
      toast.info('Hors connexion : course supprimée sur cet ordinateur. La suppression sera synchronisée au retour du réseau.');
      return;
    }
    const { error } = await supabase.from('races').delete().eq('id', race.id);
    setBusy(false);
    if (error) {
      if (isNetworkError(error)) {
        removeLocalRace(uid, race.id);
        queueOp(uid, { kind: 'race.delete', id: race.id });
        setRaces(old => old.filter(r => r.id !== race.id));
        qc.removeQueries({ queryKey: ['finishes', race.id] });
        setRaceId(null);
        toast.info('Hors connexion : course supprimée sur cet ordinateur. La suppression sera synchronisée au retour du réseau.');
        return;
      }
      toast.error('La course n’a pas pu être supprimée.');
      return;
    }
    setRaceId(null);
    qc.removeQueries({ queryKey: ['finishes', race.id] });
    await refreshRaces();
    toast.success('Course supprimée.');
  }

  return <div className="min-h-screen bg-background text-foreground">
    <AppHeader session={session} active="course" />
    <OfflineBanner />
    <main className="page-container pb-12">
      <section className="page-heading pt-10 pb-7">
        <div className="eyebrow"><span className="text-primary">02</span><span className="eyebrow-line" /> LE JOUR J</div>
        <h1 className="mt-2">La course</h1>
        <p className="text-muted-foreground text-sm mt-2">Lancez le chrono, cliquez à chaque arrivée, saisissez le dossard.</p>
      </section>

      {loading && <div className="loading-strip"><LoaderCircle className="animate-spin" size={18} /> Ouverture de votre espace…</div>}
      {!loading && !session && <AuthPanel />}
      {session && races.isLoading && <div className="loading-strip"><LoaderCircle className="animate-spin" size={18} /> Chargement des courses…</div>}

      {session && races.data && !race && <div className="table-wrap empty-list"><Flag className="empty-list-icon" size={34} /><h3>Aucune course pour l’instant</h3><p>Créez une course pour commencer.</p><Button className="mt-4" onClick={newRace} disabled={busy}><Plus />Nouvelle course</Button></div>}

      {session && race && <>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select className="class-select" style={{ maxWidth: 260 }} value={race.id} onChange={e => setRaceId(e.target.value)} aria-label="Choisir la course">
            {races.data!.map(r => <option key={r.id} value={r.id}>{r.title || 'Course sans titre'}{r.distance ? ` · ${r.distance}` : ''}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={newRace} disabled={busy}><Plus />Nouvelle course</Button>
          <Button variant="outline" size="sm" className="text-destructive border-destructive/40 ml-auto" onClick={deleteRace} disabled={busy}><Trash2 />Supprimer la course</Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-[2fr_1fr] mb-5">
          <label className="auth-field">Titre de la course<Input value={title} placeholder="Ex. 6e Filles" onChange={e => setTitle(e.target.value)} onBlur={() => title !== race.title && updateRace({ title })} /></label>
          <label className="auth-field">Longueur<Input value={distance} placeholder="Ex. 1 800 m" onChange={e => setDistance(e.target.value)} onBlur={() => distance !== race.distance && updateRace({ distance })} /></label>
        </div>

        <div className="race-panel">
          <div>
            <div className="stat-label">{race.ended_at ? 'COURSE TERMINÉE' : running ? 'CHRONO EN COURS' : 'PRÊT AU DÉPART'}</div>
            <div className={`race-clock ${running ? 'running' : ''}`}>{formatTime(elapsed)}</div>
            <div className="text-xs text-muted-foreground">{list.length} arrivée{list.length > 1 ? 's' : ''}</div>
          </div>
          <div className="race-actions">
            <Button size="lg" onClick={start} disabled={!!race.started_at}><Play />Départ course</Button>
            <Button size="lg" className="arrival-btn" onClick={arrival} disabled={!running}><UserCheck />Arrivée coureur</Button>
            <Button size="lg" variant="destructive" onClick={stop} disabled={!running}><Square />Fin de course</Button>
          </div>
        </div>

        <div className="table-wrap mt-5">
          <table className="student-table">
            <thead><tr><th>ARRIVÉE</th><th>TEMPS</th><th>DOSSARD</th><th>NOM & PRÉNOM</th><th>SEXE</th><th>CLASSE</th><th /></tr></thead>
            <tbody>
              {list.length === 0 && <tr><td colSpan={7} className="text-center text-muted-foreground py-8">Les arrivées apparaîtront ici.</td></tr>}
              {[...list].reverse().map(f => {
                const s = find(f.bib);
                const dup = f.bib && (bibCount.get(f.bib.replace(/^0+(?=\d)/, '')) ?? 0) > 1;
                return <tr key={f.id}>
                  <td><strong className="race-pos">{f.position}</strong></td>
                  <td className="font-mono">{formatTime(f.elapsed_ms)}</td>
                  <td><BibInput finish={f} onSave={setBib} /></td>
                  <td>{s ? <><strong>{s.lastName.toUpperCase()}</strong><span className="ml-2 text-muted-foreground">{s.firstName}</span></> : f.bib ? <span className="text-destructive inline-flex items-center gap-1"><AlertTriangle size={13} />Dossard inconnu</span> : null}
                    {dup && <span className="text-destructive inline-flex items-center gap-1 ml-2"><AlertTriangle size={13} />En double</span>}</td>
                  <td>{s && <span className={`sex-tag ${s.sex === 'F' ? 'female' : 'male'}`}>{s.sex}</span>}</td>
                  <td>{s?.className}</td>
                  <td><Button variant="ghost" size="icon" aria-label={`Supprimer l’arrivée ${f.position}`} onClick={() => removeFinish(f)}><Trash2 /></Button></td>
                </tr>;
              })}
            </tbody>
          </table>
        </div>
      </>}
    </main>
  </div>;
}

function BibInput({ finish, onSave }: { finish: OfflineFinish; onSave: (f: OfflineFinish, bib: string) => void }) {
  const [value, setValue] = useState(finish.bib ?? '');
  useEffect(() => setValue(finish.bib ?? ''), [finish.bib]);
  return <Input className="bib-input" inputMode="numeric" placeholder="N°" value={value}
    autoFocus={!finish.bib}
    onChange={e => setValue(e.target.value.replace(/\D/g, ''))}
    onBlur={() => onSave(finish, value)}
    onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
    aria-label={`Dossard de l’arrivée ${finish.position}`} />;
}
