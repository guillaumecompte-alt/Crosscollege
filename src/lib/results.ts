import type { Student } from './students';

export type ResultRow = { f: { id: string; position: number; elapsed_ms: number; bib: string | null }; s?: Student | undefined };
export type ClassResult = { className: string; rows: ResultRow[]; score: number; counted: number; rank: number };

export function rankClasses(rows: ResultRow[]): ClassResult[] {
  const groups = new Map<string, ResultRow[]>();
  for (const row of rows) {
    if (!row.s) continue;
    const list = groups.get(row.s.className) ?? [];
    list.push(row);
    groups.set(row.s.className, list);
  }
  const classes = [...groups].map(([className, list]) => {
    const sorted = [...list].sort((a, b) => a.f.position - b.f.position);
    return { className, rows: sorted, score: sorted.slice(0, 10).reduce((sum, row) => sum + row.f.position, 0), counted: Math.min(10, sorted.length), rank: 0 };
  }).sort((a, b) => a.score - b.score || a.className.localeCompare(b.className, 'fr', { numeric: true }));
  return classes.map((group, index) => ({ ...group, rank: index > 0 && classes[index - 1]?.score === group.score ? classes.findIndex(c => c.score === group.score) + 1 : index + 1 }));
}

export function formatTime(ms: number) {
  const t = Math.max(0, Math.floor(ms / 100));
  const pad = (n: number) => String(n).padStart(2, '0');
  const h = Math.floor(t / 36000);
  return `${h ? `${h}:` : ''}${pad(Math.floor(t / 600) % 60)}:${pad(Math.floor(t / 10) % 60)}.${t % 10}`;
}

export function distanceKm(distance: string) {
  const match = distance.toLowerCase().replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(km|m)?/);
  if (!match) return 0;
  const n = Number(match[1] ?? 0);
  return match[2] === 'km' ? n : match[2] === 'm' || n > 50 ? n / 1000 : n;
}