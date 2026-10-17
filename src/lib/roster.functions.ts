import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import type { Student } from './students';

export type Roster = { students: Student[]; sourceFile: string | null; savedAt: string | null };

const byBib = (a: Student, b: Student) => Number(a.bib) - Number(b.bib);

// Reads back the roster saved for the signed-in account. Protected by RLS:
// an account only ever sees the rows it imported.
export const getRoster = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<Roster> => {
    const { data, error } = await context.supabase
      .from('students')
      .select('bib, last_name, first_name, sex, class_name, source_file, created_at')
      .order('created_at', { ascending: true })
      .limit(5000);

    if (error) throw new Error('Impossible de récupérer la liste enregistrée. Réessayez.');

    const students = (data ?? [])
      .map(row => ({
        bib: row.bib,
        lastName: row.last_name,
        firstName: row.first_name,
        sex: row.sex as 'M' | 'F',
        className: row.class_name,
      }))
      .sort(byBib);

    const savedAt = (data ?? []).reduce<string | null>(
      (latest, row) => (!latest || row.created_at > latest ? row.created_at : latest),
      null,
    );

    return { students, sourceFile: data?.[0]?.source_file ?? null, savedAt };
  });

// Replaces the whole roster in one database call, so a new import overwrites
// the previous list without ever leaving the account with an empty one.
export const saveRoster = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { students: Student[]; sourceFile: string | null }) => {
    if (!Array.isArray(input.students)) throw new Error('Liste invalide.');
    if (input.students.length > 2000) throw new Error('Cette liste est trop longue.');
    return input;
  })
  .handler(async ({ data, context }) => {
    const { data: saved, error } = await context.supabase.rpc('replace_roster', {
      p_students: data.students.map(student => ({
        bib: student.bib,
        last_name: student.lastName,
        first_name: student.firstName,
        sex: student.sex,
        class_name: student.className,
      })),
      ...(data.sourceFile ? { p_source_file: data.sourceFile } : {}),
    });

    if (error) throw new Error("La liste n'a pas pu être enregistrée. Réessayez.");
    return { saved: saved ?? 0, expected: data.students.length };
  });
