import { describe, expect, it } from 'vitest';
import { distanceKm, rankClasses, type ResultRow } from './results';
import { resultPdfPages } from './results-pdf';

const row = (position: number, className?: string): ResultRow => ({ f: { id: String(position), position, elapsed_ms: 600000, bib: String(position).padStart(3, '0') }, s: className ? { bib: String(position), lastName: 'Éléonore', firstName: 'Chloé', sex: 'F', className } : undefined });
describe('Résultats PDF', () => {
  it('sums only ten global arrival numbers, preserves their order and ranks smallest score first', () => {
    const groups = rankClasses([row(5, '6A'), row(2, '6B'), ...Array.from({ length: 11 }, (_, i) => row(10 + i, '6C'))]);
    expect(groups.map(g => g.score)).toEqual([2, 5, 145]);
    expect(groups[1]?.rows[0]?.f.position).toBe(5);
    expect(groups[2]?.counted).toBe(10);
  });
  it('keeps equal scores tied and excludes unrecognized bibs from class scores', () => {
    expect(rankClasses([row(5, '6A'), row(2, '6B'), row(3, '6B'), row(1)]).map(g => g.rank)).toEqual([1, 1]);
  });
  it('paginates a full roster without losing rows or overflowing pages', () => {
    const rows = Array.from({ length: 400 }, (_, i) => row(i + 1, i < 200 ? '6A' : '6B'));
    const pages = resultPdfPages(rows, '1500 m');
    expect(pages.raw.flat().filter(l => !l.kind)).toHaveLength(400);
    expect(pages.reverse.flat().filter(l => !l.kind)).toHaveLength(400);
    expect([...pages.raw, ...pages.reverse].every(p => p.length <= 39)).toBe(true);
    expect(pages.raw[0]?.[1]?.cells.at(-1)).toBe('9.00');
  });
  it('converts distance units consistently with the Excel export', () => {
    expect(distanceKm('2 km')).toBe(2); expect(distanceKm('1500 m')).toBe(1.5); expect(distanceKm('1,8')).toBe(1.8);
  });
});