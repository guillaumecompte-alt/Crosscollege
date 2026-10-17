import { describe, expect, it } from 'vitest';
import { parseRows } from './students';

describe('Import des élèves', () => {
  it('lit un en-tête, les accents et les zéros initiaux', () => {
    const result = parseRows([['Numéro de dossard', 'NOM', 'Prénom', 'Sexe', 'Classe'], ['001', 'HÉBERT', 'Éloïse', 'f', '6e A'], [], ['2', 'Martin', 'Noé', 'M', '5e B']]);
    expect(result.errors).toEqual([]);
    expect(result.students[0]).toEqual({ bib: '001', lastName: 'HÉBERT', firstName: 'Éloïse', sex: 'F', className: '6e A' });
    expect(result.students).toHaveLength(2);
  });
  it('signale les doublons et les cellules invalides', () => {
    const result = parseRows([['1', 'A', 'B', 'M', '6A'], ['01', 'C', 'D', 'F', '6B'], ['-2', '', 'E', 'X', '']]);
    expect(result.errors).toHaveLength(2);
    expect(result.errors[0]).toContain('en double');
    expect(result.errors[1]).toContain('sexe attendu');
  });
  it('accepte plus de 400 élèves sans en-tête', () => {
    const result = parseRows(Array.from({ length: 451 }, (_, i) => [i + 1, 'Nom', 'Prénom', 'M', '6A']));
    expect(result.students).toHaveLength(451);
    expect(result.errors).toEqual([]);
  });
  it('rejette une feuille vide', () => expect(parseRows([]).errors).toHaveLength(1));
  it('reconnaît Classe avant Sexe dans le fichier du collège', () => {
    const result = parseRows([['N° dossard', 'Nom ', 'Prénom', 'Classe', 'Sexe'], ['001', 'HÉBERT', 'Éloïse', '4R', 'F'], ['2', 'Martin', 'Noé', '6R', 'M']]);
    expect(result.errors).toEqual([]);
    expect(result.students[0]).toEqual({ bib: '001', lastName: 'HÉBERT', firstName: 'Éloïse', sex: 'F', className: '4R' });
    expect(result.students[1]?.sex).toBe('M');
  });
  it('reconnaît les colonnes nommées même réordonnées', () => {
    const result = parseRows([['Classe', 'Sexe', 'N° dossard', 'Prénom', 'Nom'], ['6A', 'M', '007', 'Noé', 'Martin']]);
    expect(result.errors).toEqual([]);
    expect(result.students[0]).toEqual({ bib: '007', lastName: 'Martin', firstName: 'Noé', sex: 'M', className: '6A' });
  });
});