import { distanceKm, formatTime, rankClasses, type ResultRow } from './results';

type Line = { cells: string[]; kind?: 'heading' | 'header' | 'score' | 'space'; widths?: number[] };
const arrivalWidths = [105, 160, 110, 330, 270, 85, 120, 160];
const classWidths = [110, 160, 170, 130, 350, 310, 110];
const classHeader: Line = { cells: ['Rang', 'N° arrivée', 'Temps', 'Dossard', 'Nom', 'Prénom', 'Sexe'], kind: 'header', widths: classWidths };
const pageCapacity = 39;

export function resultPdfPages(rows: ResultRow[], distance: string) {
  const km = distanceKm(distance);
  const header: Line = { cells: ['N° arrivée', 'Temps', 'Dossard', 'Nom', 'Prénom', 'Sexe', 'Classe', 'km/h'], kind: 'header', widths: arrivalWidths };
  const raw: Line[][] = [];
  const ordered = [...rows].sort((a, b) => a.f.position - b.f.position);
  for (let i = 0; i < ordered.length; i += pageCapacity - 1) {
    raw.push([header, ...ordered.slice(i, i + pageCapacity - 1).map(({ f, s }) => ({ widths: arrivalWidths, cells: [String(f.position), formatTime(f.elapsed_ms), f.bib ?? '', s?.lastName.toUpperCase() ?? (f.bib ? 'Dossard inconnu' : 'Non renseigné'), s?.firstName ?? '', s?.sex ?? '', s?.className ?? '', km && f.elapsed_ms > 0 ? (km / (f.elapsed_ms / 3600000)).toFixed(2) : '—'] }))]);
  }
  const classes = rankClasses(rows);
  let page: Line[] = [];
  const reverse: Line[][] = [page];
  const add = (line: Line) => {
    if (page.length >= pageCapacity) { page = []; reverse.push(page); }
    page.push(line);
  };
  const ensure = (needed: number) => {
    if (page.length + needed > pageCapacity) { page = []; reverse.push(page); }
  };
  add({ cells: ['TOP DES CLASSES'], kind: 'heading' });
  const topHeader: Line = { cells: ['Place', 'Classe', 'Coureurs comptés', 'Score'], widths: [150, 600, 340, 250], kind: 'header' };
  add(topHeader);
  for (const c of classes) {
    if (page.length >= pageCapacity) { add({ cells: ['TOP DES CLASSES · SUITE'], kind: 'heading' }); add(topHeader); }
    add({ cells: [String(c.rank), c.className, String(c.counted), String(c.score)], widths: [150, 600, 340, 250], kind: 'score' });
  }
  if (!classes.length) add({ cells: ['Aucun dossard reconnu : aucun classement par classe.'] });
  for (const c of [...classes].sort((a, b) => a.className.localeCompare(b.className, 'fr', { numeric: true }))) {
    ensure(6);
    add({ cells: [], kind: 'space' });
    add({ cells: [`CLASSE ${c.className}`], kind: 'heading' });
    add(classHeader);
    c.rows.forEach(({ f, s }, index) => {
      if (page.length >= pageCapacity - 1) {
        page = []; reverse.push(page);
        add({ cells: [`CLASSE ${c.className} · SUITE`], kind: 'heading' }); add(classHeader);
      }
      add({ cells: [String(index + 1), String(f.position), formatTime(f.elapsed_ms), f.bib ?? '', s?.lastName.toUpperCase() ?? '', s?.firstName ?? '', s?.sex ?? ''], widths: classWidths });
    });
    add({ cells: [`Total des ${c.counted} meilleurs · numéros d’arrivée`, String(c.score)], widths: [1090, 250], kind: 'score' });
    for (let i = 0; i < 3 && page.length < pageCapacity; i++) add({ cells: [], kind: 'space' });
  }
  return { raw, reverse };
}

export async function createResultsPdf(race: { title: string; distance: string }, rows: ResultRow[]) {
  if (!rows.length) throw new Error('Aucune arrivée à exporter.');
  const { jsPDF } = await import('jspdf');
  await document.fonts.ready;
  const { raw, reverse } = resultPdfPages(rows, race.distance);
  const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  pdf.setProperties({ title: `Résultats — ${race.title || 'Cross du collège'}`, subject: 'Arrivées et classement par classe · recto-verso', creator: 'Cross du collège' });
  const styles = getComputedStyle(document.documentElement);
  const color = (token: string) => styles.getPropertyValue(token).trim();
  const palette = { paper: color('--card'), ink: color('--foreground'), muted: color('--muted-foreground'), light: color('--muted'), accent: color('--primary'), red: color('--destructive'), onRed: color('--destructive-foreground') };
  const total = Math.max(raw.length, reverse.length) * 2;
  const canvas = document.createElement('canvas'); canvas.width = 1500; canvas.height = 2121;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('La création PDF n’est pas disponible dans ce navigateur.');
  const text = (value: string, x: number, y: number, width: number, size = 23, bold = false) => {
    ctx.font = `${bold ? '700' : '400'} ${size}px Manrope, Arial, sans-serif`;
    // Wrap rather than truncate names, including long Unicode names.
    const lines: string[] = []; let current = '';
    for (const char of value) { if (ctx.measureText(current + char).width > width && current) { lines.push(current); current = char; } else current += char; }
    if (current) lines.push(current);
    if (lines.length > 2 && size > 12) { text(value, x, y, width, size - 1, bold); return; }
    lines.slice(0, 2).forEach((line, i) => ctx.fillText(line, x, y + i * (size + 2)));
  };
  for (let i = 0; i < total; i++) {
    if (i) pdf.addPage();
    const isRaw = i % 2 === 0;
    const lines = (isRaw ? raw : reverse)[Math.floor(i / 2)] ?? [];
    ctx.fillStyle = palette.paper; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.textBaseline = 'top'; ctx.fillStyle = palette.accent;
    text('CROSS DU COLLÈGE', 80, 65, 1340, 26, true);
    ctx.fillStyle = palette.ink;
    text(race.title || 'Course sans titre', 80, 115, 1340, 40, true);
    ctx.fillStyle = palette.muted;
    text(`${isRaw ? 'RECTO · LISTING BRUT D’ARRIVÉE' : 'VERSO · CLASSEMENT PAR CLASSE'}${race.distance ? ` · ${race.distance}` : ''}`, 80, 220, 1340, 23, true);
    if (!lines.length) text('Cette face est réservée à la suite du document recto-verso.', 80, 300, 1340, 24);
    lines.forEach((line, index) => {
      const y = 290 + index * 44;
      if (line.kind === 'space') return;
      const widths = line.widths ?? [1340];
      ctx.fillStyle = line.kind === 'header' || index % 2 === 0 ? palette.light : palette.paper;
      ctx.fillRect(80, y, 1340, 44);
      let x = 80;
      line.cells.forEach((cell, ci) => {
        const width = widths[ci] ?? 1340;
        const red = line.kind === 'score' && ci === line.cells.length - 1;
        if (red) { ctx.fillStyle = palette.red; ctx.fillRect(x, y, width, 44); }
        ctx.fillStyle = red ? palette.onRed : line.kind === 'heading' ? palette.accent : palette.ink;
        text(cell, x + 9, y + 6, width - 18, line.kind === 'heading' ? 25 : 17, !!line.kind);
        x += width;
      });
    });
    ctx.fillStyle = palette.muted;
    text('Score : somme des numéros d’arrivée des 10 meilleurs, ou des présents si moins de 10. Ex æquo à score égal.', 80, 2030, 1340, 19);
    text(`Page ${i + 1} / ${total} · Impression A4 recto-verso, retournement sur le bord long`, 80, 2070, 1340, 19);
    pdf.addImage(canvas.toDataURL('image/jpeg', 0.94), 'JPEG', 0, 0, 210, 297);
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  return pdf;
}