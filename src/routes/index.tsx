import { createFileRoute } from '@tanstack/react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronLeft, ChevronRight, FileSpreadsheet, Flag, LoaderCircle, Lock, LogOut, Printer, RefreshCw, Search, ShieldCheck, Timer, Trophy, Upload, Users, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { AuthPanel } from '@/components/auth-panel';
import { AppHeader } from '@/components/app-header';
import { OfflineBanner } from '@/components/offline-banner';
import { useAuth } from '@/hooks/useAuth';
import { getRoster, saveRoster, type Roster } from '@/lib/roster.functions';
import { readStudents, downloadTemplate } from '@/lib/students';
import { createBibPdf } from '@/lib/bib-pdf';
import { fetchRosterWithCache, isNetworkError } from '@/lib/offline';
import { supabase } from '@/integrations/supabase/client';
const mascotUrl = '/mascotte-cross.svg';

export const Route = createFileRoute('/')({
  head: () => ({ meta: [
    { title: 'Import Liste · Cross du collège' },
    { name: 'description', content: 'Importez la liste Excel des élèves et imprimez les dossards du cross du collège en PDF.' },
    { property: 'og:title', content: 'Import Liste · Cross du collège' },
    { property: 'og:description', content: 'La liste des élèves et les dossards du cross, prêts pour le départ.' },
    { property: 'og:type', content: 'website' },
    { name: 'twitter:card', content: 'summary_large_image' },
  ] }),
  component: Index,
});

const savedLabel = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

function Index() {
  const { session, loading } = useAuth();
  const queryClient = useQueryClient();
  const [errors, setErrors] = useState<string[]>([]);
  const [errorTitle, setErrorTitle] = useState('Le fichier n’a pas été importé.');
  const [errorDescription, setErrorDescription] = useState('Corrigez les lignes indiquées puis réessayez.');
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [perPage, setPerPage] = useState<2 | 4>(4);
  const inputRef = useRef<HTMLInputElement>(null);

  const email = session?.user.email ?? '';
  const rosterKey = useMemo(() => ['roster', session?.user.id ?? 'anon'], [session?.user.id]);
  const fetchRoster = useServerFn(getRoster);
  const persistRoster = useServerFn(saveRoster);
  const roster = useQuery({
    queryKey: rosterKey, enabled: !!session,
    queryFn: () => fetchRosterWithCache(session!.user.id, () => fetchRoster()),
  });

  const data = roster.data;
  const students = data?.students ?? [];
  const classes = useMemo(() => [...new Set(students.map(s => s.className))].sort((a, b) => a.localeCompare(b, 'fr', { numeric: true })), [students]);
  const filtered = useMemo(() => students.filter(s => (classFilter === 'all' || s.className === classFilter) && `${s.bib} ${s.lastName} ${s.firstName} ${s.className}`.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr'))), [students, search, classFilter]);
  const maxPage = Math.max(0, Math.ceil(filtered.length / 8) - 1);
  const currentPage = Math.min(page, maxPage);
  const preview = filtered[0];
  const boys = students.filter(s => s.sex === 'M').length;
  const girls = students.length - boys;
  const ready = !!session && !!data;

  async function importFile(file?: File) {
    if (!file || busy) return;
    setErrors([]);
    if (!/\.(xlsx|xls)$/i.test(file.name)) { setErrors(['Choisissez un fichier Excel au format .xlsx ou .xls.']); return; }
    if (file.size > 20 * 1024 * 1024) { setErrors(['Le fichier dépasse 20 Mo.']); return; }

    setBusy(true);
    try {
      const result = await readStudents(file);
      if (result.errors.length) { setErrors(result.errors); return; }

      setSaving(true);
      try {
        const saved = await persistRoster({ data: { students: result.students, sourceFile: file.name } });
        queryClient.setQueryData<Roster>(rosterKey, { students: result.students, sourceFile: file.name, savedAt: new Date().toISOString() });
        setSearch(''); setClassFilter('all'); setPage(0);

        if (saved.saved < saved.expected) setErrors([`${saved.saved} élèves sur ${saved.expected} ont été enregistrés. Vérifiez les lignes concernées dans le fichier.`]);
        else toast.success(`${saved.saved} élèves enregistrés`);
      } catch (error) {
        setErrors([isNetworkError(error)
          ? 'Vous êtes hors connexion : reconnectez-vous pour importer une nouvelle liste. La liste actuelle reste disponible sur cet ordinateur.'
          : error instanceof Error ? error.message : "La liste n'a pas pu être enregistrée."]);
      } finally {
        setSaving(false);
      }
    } catch (error) {
      setErrors([error instanceof Error ? error.message : "La liste n'a pas pu être enregistrée."]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function printBibs() {
    setPrinting(true); setErrors([]);
    setErrorTitle('Les dossards n’ont pas pu être générés.');
    setErrorDescription('La liste enregistrée est conservée. Vérifiez le message ci-dessous puis réessayez.');
    try { const pdf = await createBibPdf(filtered, perPage, mascotUrl); pdf.save('dossards-cross.pdf'); }
    catch (error) { setErrors([error instanceof Error ? error.message : 'Impossible de générer les dossards.']); }
    finally { setPrinting(false); }
  }

  return <div className="min-h-screen bg-background text-foreground">
    <AppHeader session={session} active="import" />
    <OfflineBanner />

    <main className="page-container pb-12">
      <section className="page-heading flex items-end justify-between gap-5 pt-10 pb-7">
        <div><div className="eyebrow"><span className="text-primary">01</span><span className="eyebrow-line" /> AVANT LE DÉPART</div><h1 className="mt-2">La liste des participants</h1><p className="text-muted-foreground text-sm mt-2">Les élèves, leurs classes, leurs dossards. Tout commence ici.</p></div>
        <span className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground mb-1"><ShieldCheck size={16} /> Liste enregistrée, accès protégé</span>
      </section>

      {loading && <div className="loading-strip"><LoaderCircle className="animate-spin" size={18} /> Ouverture de votre espace…</div>}

      {!loading && !session && <><AuthPanel /><footer className="border-t border-border mt-10 pt-5 text-[11px] text-muted-foreground">Votre liste reste enregistrée : elle vous attendra à la réouverture, sur n’importe quel ordinateur.</footer></>}

      {!loading && session && roster.isError && <section role="alert" className="error-panel mt-2"><div className="flex justify-between items-start gap-3"><div><strong>La liste enregistrée n’a pas pu être chargée.</strong><p className="text-sm mt-1">Vérifiez la connexion puis réessayez.</p></div><Button variant="ghost" size="icon" aria-label="Fermer les erreurs" onClick={() => setErrors([])}><X /></Button></div><Button variant="outline" size="sm" className="mt-3" onClick={() => void roster.refetch()}><RefreshCw /> Réessayer</Button></section>}

      {!loading && session && !data && !roster.isError && <div className="loading-strip"><LoaderCircle className="animate-spin" size={18} /> Chargement de votre liste…</div>}

      {ready && <>
        <section className="stats-grid grid grid-cols-2 md:grid-cols-4 border-y border-border bg-card">
          {[{ label: 'PARTICIPANTS', count: students.length, icon: Users, detail: 'élèves inscrits', color: 'primary' }, { label: 'CLASSES', count: classes.length, icon: FileSpreadsheet, detail: 'classes représentées', color: 'neutral' }, { label: 'FILLES', count: girls, icon: Users, detail: 'participantes', color: 'rose' }, { label: 'GARÇONS', count: boys, icon: Users, detail: 'participants', color: 'green' }].map(({ label, count, icon: Icon, detail, color }) => <div key={label} className="stat-item"><div className="flex justify-between items-center gap-2"><span className="stat-label">{label}</span><Icon size={17} className={`stat-icon ${color}`} /></div><div className="stat-value">{count.toLocaleString('fr')}</div><div className="text-xs text-muted-foreground">{detail}</div></div>)}
        </section>

        <div className="save-strip">
          <CheckCircle2 size={16} className="save-icon shrink-0" />
          <span className="font-semibold">{students.length ? `${students.length.toLocaleString('fr')} élèves enregistrés` : 'Aucune liste enregistrée pour le moment'}</span>
          {data?.sourceFile && <span className="text-muted-foreground truncate">· {data.sourceFile}</span>}
          <span className="save-time">{data?.savedAt ? `Sauvegardé le ${savedLabel(data.savedAt)}` : ''}</span>
        </div>

        {errors.length > 0 && <section role="alert" className="error-panel mt-5"><div className="flex justify-between items-start gap-3"><div><strong>{errorTitle}</strong><p className="text-sm mt-1">{errorDescription}</p></div><Button variant="ghost" size="icon" aria-label="Fermer les erreurs" onClick={() => setErrors([])}><X /></Button></div><ul className="text-sm mt-3 max-h-44 overflow-auto space-y-1">{errors.map((error, i) => <li key={i}>{error}</li>)}</ul></section>}

        <div className="workspace-grid grid lg:grid-cols-[minmax(0,1fr)_340px] gap-8 mt-8">
          <div className="min-w-0">
            <section><div className="section-title-row"><h2>Importer les élèves</h2><Button variant="ghost" size="sm" onClick={downloadTemplate} className="text-muted-foreground"><ArrowDownToLine /> Modèle Excel</Button></div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls" className="sr-only" aria-label="Importer un fichier Excel" onChange={e => void importFile(e.target.files?.[0])} />
              <div className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={e => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); void importFile(e.dataTransfer.files[0]); }}>
                <span className="upload-icon">{busy || saving ? <LoaderCircle className="animate-spin" size={24} /> : <Upload size={24} />}</span>
                <h3>{busy ? 'Lecture du fichier…' : saving ? 'Enregistrement de la liste…' : 'Déposez votre fichier Excel ici'}</h3>
                <p className="text-xs text-muted-foreground mt-2">ou sélectionnez-le depuis votre ordinateur</p>
                <Button onClick={() => inputRef.current?.click()} disabled={busy || saving} className="mt-5 h-10 px-5"><FileSpreadsheet /> {data?.sourceFile ? 'Remplacer le fichier' : 'Choisir un fichier'}<ArrowRight /></Button>
                <span className="block text-[11px] text-muted-foreground mt-4">.XLSX ou .XLS · 20 Mo maximum</span>
              </div>
              {data?.sourceFile && students.length > 0 && <div className="flex items-center gap-2 mt-3 text-xs font-medium text-success"><Check size={15} /><span className="truncate">{data.sourceFile}</span><span className="ml-auto shrink-0">{students.length} élèves importés</span></div>}
              <div className="file-columns flex items-center gap-3 mt-4"><FileSpreadsheet size={17} className="shrink-0 text-muted-foreground" /><div><span className="text-xs font-semibold">Colonnes reconnues grâce aux en-têtes</span><p className="text-[11px] text-muted-foreground mt-1">N° de dossard <span>·</span> NOM <span>·</span> Prénom <span>·</span> Classe <span>·</span> Sexe (M / F)</p></div></div>
            </section>

            <section className="mt-8"><div className="section-title-row"><div className="flex items-center gap-2"><h2>Liste des élèves</h2><span className="count-badge">{students.length}</span></div><span className="text-xs text-muted-foreground">{students.length ? 'Liste enregistrée' : 'Aucune liste importée'}</span></div>
              <div className="flex gap-3 mb-4"><div className="relative flex-1"><Search size={16} className="absolute left-3 top-3 text-muted-foreground" /><Input className="pl-9 h-10 bg-card text-xs" placeholder="Rechercher un élève ou un dossard…" aria-label="Rechercher un élève" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} /></div><select aria-label="Filtrer par classe" className="class-select" value={classFilter} onChange={e => { setClassFilter(e.target.value); setPage(0); }}><option value="all">Toutes les classes</option>{classes.map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="table-wrap"><table className="student-table"><thead><tr><th>DOSSARD</th><th>NOM & PRÉNOM</th><th>SEXE</th><th>CLASSE</th></tr></thead><tbody>{filtered.slice(currentPage * 8, currentPage * 8 + 8).map(s => <tr key={s.bib}><td><span className="bib-tag">{s.bib}</span></td><td><strong>{s.lastName.toUpperCase()}</strong><span className="ml-2 text-muted-foreground">{s.firstName}</span></td><td><span className={`sex-tag ${s.sex === 'F' ? 'female' : 'male'}`}>{s.sex}</span></td><td>{s.className}</td></tr>)}</tbody></table>
              {!filtered.length && <div className="empty-list"><span className="empty-list-icon"><Users size={28} strokeWidth={1.5} /></span><h3>{students.length ? 'Aucun élève trouvé' : 'La ligne de départ est encore vide'}</h3><p>{students.length ? 'Essayez un autre nom, dossard ou classe.' : 'Votre liste d’élèves apparaîtra ici après l’import.'}</p></div>}</div>
              <div className="flex items-center justify-between mt-3 text-[11px] text-muted-foreground"><span>{filtered.length ? `${currentPage * 8 + 1}–${Math.min(currentPage * 8 + 8, filtered.length)} sur ${filtered.length} élèves` : '0 élève'}</span><div className="flex items-center gap-2"><Button variant="outline" size="icon" className="size-7 bg-card" disabled={!currentPage} aria-label="Page précédente" onClick={() => setPage(currentPage - 1)}><ChevronLeft /></Button><span>{currentPage + 1} / {maxPage + 1}</span><Button variant="outline" size="icon" className="size-7 bg-card" disabled={currentPage >= maxPage} aria-label="Page suivante" onClick={() => setPage(currentPage + 1)}><ChevronRight /></Button></div></div>
            </section>
          </div>

          <aside className="print-panel lg:border-l lg:border-border lg:pl-7"><div className="section-title-row"><h2>Les dossards</h2><Printer size={17} className="text-muted-foreground" /></div><div className="flex justify-between items-center text-xs mb-3"><span className="text-muted-foreground">Aperçu du dossard</span><span className="preview-label">{preview ? 'PRÊT À IMPRIMER' : 'EXEMPLE'}</span></div>
            <div className="bib-preview"><div className="flex items-center justify-between"><img src={mascotUrl} alt="Mascotte du cross" className="size-14 object-contain" /><span className="bib-event">CROSS DU COLLÈGE</span><span className="w-9" /></div><div className="bib-number">{preview?.bib ?? '001'}</div><div className="bib-name">{preview ? `${preview.lastName.toUpperCase()} ${preview.firstName}` : 'MARTIN Lucas'}</div><div className="bib-class">{preview?.className ?? '6e A'}</div></div>
            <div className="flex justify-center gap-1.5 text-[10px] text-muted-foreground mt-3"><span className="cut-line" />Repères de découpe inclus<span className="cut-line" /></div>
            <div className="mt-7"><label className="block text-xs font-semibold mb-3">Dossards par page A4</label><div className="grid grid-cols-2 gap-2">{([2, 4] as const).map(n => <Button key={n} variant="outline" onClick={() => setPerPage(n)} aria-pressed={perPage === n} className={`layout-option h-20 flex-col gap-2 ${perPage === n ? 'selected' : ''}`}><span className={`page-diagram diagram-${n}`}>{Array.from({ length: n }, (_, i) => <i key={i} />)}</span><span className="text-xs">{n} par page</span>{perPage === n && <Check className="layout-check" />}</Button>)}</div></div>
            <div className="print-summary mt-5 space-y-3"><div><span>Dossards à imprimer</span><strong>{filtered.length}</strong></div><div><span>Pages A4</span><strong>{Math.ceil(filtered.length / perPage)}</strong></div><div><span>Orientation</span><strong>{perPage === 4 ? 'Paysage' : 'Portrait'}</strong></div><div><span>Format de sortie</span><strong>PDF</strong></div></div>
            <Button disabled={!filtered.length || printing} onClick={() => void printBibs()} className="w-full h-11 mt-5">{printing ? <LoaderCircle className="animate-spin" /> : <Printer />}{printing ? 'Création du PDF…' : 'Générer les dossards PDF'}</Button>
            <p className="text-[11px] text-muted-foreground text-center mt-3">{students.length ? 'Les filtres de la liste s’appliquent à l’impression.' : 'Importez une liste pour préparer l’impression.'}</p>
            <div className="mascot-note mt-8 flex gap-3 items-center border-t border-border pt-5"><img src={mascotUrl} alt="" className="size-14 object-contain shrink-0" /><div><span className="text-xs font-bold">À chacun son dossard.</span><p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">À tous, le plaisir de courir.</p></div></div>
          </aside>
        </div>
      </>}

      {ready && <footer className="border-t border-border mt-10 pt-5 flex flex-wrap justify-between gap-3 text-[11px] text-muted-foreground"><span>Cross du collège <span className="mx-2">/</span> Un départ bien préparé.</span><span>Liste enregistrée : elle vous attendra à la réouverture.</span></footer>}
    </main>
  </div>;
}
