import * as XLSX from 'xlsx';

export type Student = { bib: string; lastName: string; firstName: string; sex: 'M' | 'F'; className: string };
export type ImportResult = { students: Student[]; errors: string[] };
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export function parseRows(rows: unknown[][]): ImportResult {
  const students: Student[] = [];
  const errors: string[] = [];
  const seen = new Set<string>();
  let firstContentRow = true;
  let columns = [0, 1, 2, 3, 4];
  rows.forEach((row, index) => {
    const cells = row.map(value => String(value ?? '').trim());
    if (cells.every(value => !value)) return;
    const isHeader = firstContentRow && !/^\d+$/.test(cells[0] ?? '') && (cells.some(cell => normalize(cell).includes('dossard')) || (normalize(cells[1] ?? '') === 'nom' && normalize(cells[2] ?? '') === 'prenom'));
    firstContentRow = false;
    if (isHeader) {
      const headers = cells.map(normalize);
      const mapped = [
        headers.findIndex(header => header.includes('dossard')),
        headers.findIndex(header => header === 'nom'),
        headers.findIndex(header => header === 'prenom'),
        headers.findIndex(header => header === 'sexe'),
        headers.findIndex(header => header === 'classe'),
      ];
      if (mapped.some(column => column < 0)) {
        errors.push(`Ligne ${index + 1} : en-têtes attendus : N° dossard, Nom, Prénom, Sexe et Classe.`);
      } else {
        columns = mapped;
      }
      return;
    }
    const [bib, lastName, firstName, rawSex, className] = columns.map(column => cells[column]);
    const sex = rawSex?.toUpperCase();
    const issues: string[] = [];
    if (!bib || !/^\d+$/.test(bib) || Number(bib) <= 0) issues.push('numéro de dossard entier positif attendu');
    if (!lastName || !firstName || !className) issues.push('nom, prénom ou classe manquant');
    if (sex !== 'M' && sex !== 'F') issues.push('sexe attendu : M ou F');
    const key = bib ? String(Number(bib)) : '';
    if (key && seen.has(key)) issues.push(`dossard ${bib} en double`);
    if (key) seen.add(key);
    if (issues.length) { errors.push(`Ligne ${index + 1} : ${issues.join(' ; ')}.`); return; }
    if (bib && lastName && firstName && className && (sex === 'M' || sex === 'F')) students.push({ bib, lastName, firstName, sex, className });
  });
  if (!students.length && !errors.length) errors.push('Ce fichier ne contient aucun élève.');
  return { students, errors };
}

export async function readStudents(file: File): Promise<ImportResult> {
  const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  const sheet = sheetName ? workbook.Sheets[sheetName] : undefined;
  if (!sheet) throw new Error('Aucune feuille trouvée dans ce fichier.');
  return parseRows(XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, raw: false, defval: '', blankrows: true }));
}

export function downloadTemplate() {
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([['Numéro de dossard', 'NOM', 'Prénom', 'Sexe', 'Classe']]);
  sheet['!cols'] = [{ wch: 22 }, { wch: 24 }, { wch: 24 }, { wch: 10 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(workbook, sheet, 'Élèves');
  XLSX.writeFile(workbook, 'modele-liste-cross.xlsx');
}