import { createFileRoute } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileText, LoaderCircle, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AuthPanel } from '@/components/auth-panel';
import { AppHeader } from '@/components/app-header';
import { OfflineBanner } from '@/components/offline-banner';
import { useAuth } from '@/hooks/useAuth';
import { getRoster } from '@/lib/roster.functions';
import { fetchFinishesWithCache, fetchRacesWithCache, fetchRosterWithCache, type OfflineFinish, type OfflineRace } from '@/lib/offline';
import { rankClasses } from '@/lib/results';
import { createResultsPdf } from '@/lib/results-pdf';

export const Route = createFileRoute('/resultats')({
  head: () => ({ meta: [
    { title: 'Résultats · Cross du collège' },
    { name: 'description', content: 'Classement général et par classe du cross du collège, exports Excel et PDF recto-verso.' },
    { property: 'og:title', content: 'Résultats · Cross du collège' },
    { property: 'og:description', content: 'Exportez les arrivées, les classements par classe et le top des classes en PDF recto-verso ou Excel.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: ResultsPage,
});

const fmt = (ms: number) => {
  const t = Math.max(0, Math.floor(ms / 100));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(t / 36000);
  return `${h ? `${h}:` : ''}${pad(Math.floor(t / 600) % 60)}:${pad(Math.floor(t / 10) % 60)}.${t % 10}`;
};
const norm = (b: string) => b.trim().replace(/^0+(?=\d)/, '');
// "2 km", "1500 m", "1,8" → km. A bare number above 50 is read as meters.
const parseKm = (d: string) => {
  const m = d.toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(km|m)?/);
  if (!m) return 0;
  const n = parseFloat(m[1] ?? '0');
  return m[2] === 'km' ? n : m[2] === 'm' || n > 50 ? n / 1000 : n;
};

function ResultsPage() {
  const { session, loading } = useAuth();
  const fetchRoster = useServerFn(getRoster);
  const roster = useQuery({
    queryKey: ['roster', session?.user.id ?? 'anon'], enabled: !!session,
    queryFn: () => fetchRosterWithCache(session!.user.id, () => fetchRoster()),
  });
  const races = useQuery({
    queryKey: ['races', session?.user.id], enabled: !!session,
    queryFn: () => fetchRacesWithCache(session!.user.id),
  });
  const [raceId, setRaceId] = useState<string | null>(null);
  const [pdfBusy, setPdfBusy] = useState(false);
  const race = races.data?.find(r => r.id === raceId) ?? races.data?.[0];
  const finishes = useQuery({
    queryKey: ['finishes', race?.id], enabled: !!race,
    queryFn: () => fetchFinishesWithCache(session!.user.id, race!.id),
  });

  const rows = useMemo(() => {
    const map = new Map((roster.data?.students ?? []).map(s => [norm(s.bib), s]));
    return (finishes.data ?? []).map((f: OfflineFinish) => ({ f, s: f.bib ? map.get(norm(f.bib)) : undefined }));
  }, [roster.data, finishes.data]);

  const byClass = useMemo(() => {
    const g = new Map<string, typeof rows>();
    rows.forEach(r => { if (r.s) { const k = r.s.className; g.set(k, [...(g.get(k) ?? []), r]); } });
    return [...g.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr', { numeric: true }));
  }, [rows]);

  // Same score as the red box in the Excel export: sum of the 10 best arrival numbers.
  const scores = useMemo(() => new Map(rankClasses(rows).map(c => [c.className, c])), [rows]);

  async function exportXlsx() {
    if (!race) return;
    const ExcelJS = (await import('exceljs')).default;
    const km = parseKm(race.distance);
    const wb = new ExcelJS.Workbook();
    const bold = (r: { font: unknown }) => { r.font = { bold: true }; };

    const ws1 = wb.addWorksheet('Arrivées');
    ws1.columns = [['N° arrivée', 10], ['Temps', 10], ['Dossard', 9], ['Nom', 22], ['Prénom', 18], ['Sexe', 6], ['Classe', 9], ['Vitesse (km/h)', 14]].map(([header, width]) => ({ header: header as string, width: width as number }));
    bold(ws1.getRow(1));
    rows.forEach(({ f, s }) => {
      const r = ws1.addRow([f.position, fmt(f.elapsed_ms), f.bib ?? '', s?.lastName.toUpperCase() ?? (f.bib ? 'Dossard inconnu' : ''), s?.firstName ?? '', s?.sex ?? '', s?.className ?? '', km && f.elapsed_ms > 0 ? km / (f.elapsed_ms / 3600000) : '']);
      r.getCell(8).numFmt = '0.00';
    });

    const ws2 = wb.addWorksheet('Par classe');
    ws2.columns = [9, 11, 10, 10, 9, 22, 18, 6].map(width => ({ width }));
    const head = ['Classe', 'Rang classe', 'N° arrivée', 'Temps', 'Dossard', 'Nom', 'Prénom', 'Sexe'];
    byClass.forEach(([c, list], ci) => {
      if (ci > 0) for (let k = 0; k < 3; k++) ws2.addRow([]);
      bold(ws2.addRow(head));
      const first = ws2.rowCount + 1;
      list.forEach(({ f, s }, i) => ws2.addRow([c, i + 1, f.position, fmt(f.elapsed_ms), f.bib ?? '', s?.lastName.toUpperCase() ?? '', s?.firstName ?? '', s?.sex ?? '']));
      const last = first + Math.min(10, list.length) - 1;
      const total = list.slice(0, 10).reduce((a, { f }) => a + f.position, 0);
      const r = ws2.addRow(['', `Total des ${Math.min(10, list.length)} meilleurs`, { formula: `SUM(C${first}:C${last})`, result: total }]);
      const cell = r.getCell(3);
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFF0000' } };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      r.getCell(2).font = { bold: true };
    });

    const buf = await wb.xlsx.writeBuffer();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }));
    a.download = `resultats_${(race.title || 'course').replace(/[^\p{L}\p{N}]+/gu, '_')}.xlsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(km ? 'Fichier Excel téléchargé.' : 'Fichier téléchargé — distance non renseignée, vitesse vide.');
  }

  async function exportPdf() {
    if (!race || pdfBusy || !rows.length) return;
    setPdfBusy(true);
    try {
      const pdf = await createResultsPdf(race, rows);
      pdf.save(`resultats_${(race.title || 'course').replace(/[^\p{L}\p{N}]+/gu, '_')}_recto_verso.pdf`);
      toast.success('PDF téléchargé. Impression recto-verso, retournement sur le bord long.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Le PDF n’a pas pu être créé. Réessayez.');
    } finally { setPdfBusy(false); }
  }

  return <div className="min-h-screen bg-background text-foreground">
    <AppHeader session={session} active="results" />
    <OfflineBanner />
    <main className="page-container pb-12">
      <section className="page-heading pt-10 pb-7">
        <div className="eyebrow"><span className="text-primary">03</span><span className="eyebrow-line" /> LE PALMARÈS</div>
        <h1 className="mt-2">Résultats</h1>
        <p className="text-muted-foreground text-sm mt-2">Choisissez une course et exportez le classement en Excel.</p>
      </section>
      {loading && <div className="loading-strip"><LoaderCircle className="animate-spin" size={18} /> Ouverture de votre espace…</div>}
      {!loading && !session && <AuthPanel />}
      {session && races.data && !race && <div className="table-wrap empty-list"><Trophy className="empty-list-icon" size={34} /><h3>Aucune course</h3><p>Créez une course dans l’onglet Course.</p></div>}
      {session && race && <>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <select className="class-select" style={{ maxWidth: 280 }} value={race.id} onChange={e => setRaceId(e.target.value)} aria-label="Choisir la course">
             {races.data?.map(r => <option key={r.id} value={r.id}>{r.title || 'Course sans titre'}{r.distance ? ` · ${r.distance}` : ''}</option>)}
          </select>
          <Button className="ml-auto" onClick={exportXlsx} disabled={!rows.length}><Download />Exporter en Excel</Button>
          <Button variant="outline" onClick={exportPdf} disabled={!rows.length || pdfBusy || roster.isPending || finishes.isFetching}>
            {pdfBusy ? <LoaderCircle className="animate-spin" /> : <FileText />}{pdfBusy ? 'Création du PDF…' : 'Exporter en PDF'}
          </Button>
        </div>
        <h2 className="text-lg font-semibold mb-3">Classement par classe</h2>
        {!byClass.length && <p className="text-muted-foreground text-sm">Aucun dossard reconnu pour cette course.</p>}
        {byClass.map(([c, list]) => {
          const scored = scores.get(c);
          return <div key={c} className="table-wrap mb-4">
          <table className="student-table">
            <thead><tr><th colSpan={6}>CLASSE {c}</th></tr><tr><th>RANG</th><th>N° ARRIVÉE</th><th>TEMPS</th><th>DOSSARD</th><th>NOM & PRÉNOM</th><th>SEXE</th></tr></thead>
            <tbody>{list.map(({ f, s }, i) => <tr key={f.id}>
              <td><strong>{i + 1}</strong></td><td>{f.position}</td><td className="font-mono">{fmt(f.elapsed_ms)}</td><td>{f.bib}</td>
              <td><strong>{s?.lastName.toUpperCase()}</strong><span className="ml-2 text-muted-foreground">{s?.firstName}</span></td>
              <td><span className={`sex-tag ${s?.sex === 'F' ? 'female' : 'male'}`}>{s?.sex}</span></td>
            </tr>)}</tbody>
            <tfoot>{scored && <tr className="class-total-row">
              <td colSpan={4} className="class-total-label">Total des {scored.counted} meilleurs · numéros d’arrivée</td>
              <td colSpan={2}><span className="class-total">{scored.score}</span></td>
            </tr>}</tfoot>
          </table>
          {scored && <div className="class-total-bar">
            <span className="class-total-label">Total des {scored.counted} meilleurs · numéros d’arrivée</span>
            <span className="class-total">{scored.score}</span>
          </div>}
        </div>;
        })}
      </>}
    </main>
  </div>;
}
