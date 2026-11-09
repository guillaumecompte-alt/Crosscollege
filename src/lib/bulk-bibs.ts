import type { Student } from "./students";

// Bulk bib entry: one bib per line, matched in order with the race's arrivals.
// Line 1 goes to the chosen starting arrival, line 2 to the next one, etc.
// Extra lines create arrivals without a time. "?" or "-" keeps a place for a
// runner whose bib is unknown.

export type BulkFinish = {
  id: string;
  position: number;
  elapsed_ms: number | null;
  bib: string | null;
};

/** "fill" keeps bibs already typed; "replace" overwrites them. */
export type BulkMode = "fill" | "replace";

export type BulkAction =
  | "set" // bib written on an existing arrival
  | "same" // arrival already had this bib
  | "keep" // arrival already had another bib, kept (fill mode)
  | "create" // new arrival without a time
  | "skip"; // "?" placeholder on an existing arrival: nothing changes

export type BulkLine = {
  line: number;
  raw: string;
  bib: string | null;
  position: number;
  finishId: string | null;
  elapsedMs: number | null;
  previousBib: string | null;
  action: BulkAction;
  student?: Student;
  error?: string;
  warnings: string[];
};

export type BulkPlan = {
  lines: BulkLine[];
  errors: number;
  warnings: number;
  updated: number;
  created: number;
  kept: number;
  /** Arrivals after the pasted list that still have no bib. */
  emptyAfter: number[];
};

const PLACEHOLDER = /^[?-]$/;
const norm = (bib: string) => bib.trim().replace(/^0+(?=\d)/, "");

/** First arrival without a bib, or the next position after the last arrival. */
export function defaultStart(finishes: BulkFinish[]): number {
  const ordered = [...finishes].sort((a, b) => a.position - b.position);
  const empty = ordered.find((f) => !f.bib);
  if (empty) return empty.position;
  return (ordered.at(-1)?.position ?? 0) + 1;
}

export function planBulk(input: {
  text: string;
  finishes: BulkFinish[];
  students: Student[];
  start: number;
  mode: BulkMode;
}): BulkPlan {
  const ordered = [...input.finishes].sort((a, b) => a.position - b.position);
  const byBib = new Map(input.students.map((s) => [norm(s.bib), s]));
  const entries = input.text
    .split(/\r?\n/)
    .map((raw, i) => ({ raw: raw.trim(), line: i + 1 }))
    .filter((e) => e.raw !== "");

  let index = ordered.findIndex((f) => f.position >= input.start);
  if (index < 0) index = ordered.length;
  let nextPosition = (ordered.at(-1)?.position ?? 0) + 1;

  const lines: BulkLine[] = entries.map(({ raw, line }) => {
    const finish = ordered[index++];
    const position = finish ? finish.position : nextPosition++;
    const base = {
      line,
      raw,
      position,
      finishId: finish?.id ?? null,
      elapsedMs: finish ? finish.elapsed_ms : null,
      previousBib: finish?.bib ?? null,
      warnings: [] as string[],
    };

    if (PLACEHOLDER.test(raw)) {
      return { ...base, bib: null, action: finish ? "skip" : "create" };
    }
    if (!/^\d+$/.test(raw) || Number(raw) <= 0) {
      return {
        ...base,
        bib: null,
        action: "skip",
        error:
          "Numéro de dossard attendu (chiffres uniquement), ou « ? » si le dossard est inconnu.",
      };
    }

    const student = byBib.get(norm(raw));
    let action: BulkAction = "create";
    if (finish) {
      if (finish.bib && norm(finish.bib) === norm(raw)) action = "same";
      else if (finish.bib && input.mode === "fill") action = "keep";
      else action = "set";
    }
    return { ...base, bib: raw, action, ...(student ? { student } : {}) };
  });

  // Bibs as they will be after applying the plan, to spot duplicates.
  const finalBib = new Map<number, string | null>(
    ordered.map((f) => [f.position, f.bib]),
  );
  for (const l of lines) {
    if (l.error) continue;
    if (l.action === "set" || l.action === "create")
      finalBib.set(l.position, l.bib);
  }
  const positionsByBib = new Map<string, number[]>();
  for (const [position, bib] of finalBib) {
    if (!bib) continue;
    const key = norm(bib);
    positionsByBib.set(key, [...(positionsByBib.get(key) ?? []), position]);
  }

  for (const l of lines) {
    if (l.error || !l.bib) continue;
    if (l.action === "keep") {
      l.warnings.push(
        `L’arrivée n°${l.position} a déjà le dossard ${l.previousBib} : il est conservé.`,
      );
      continue;
    }
    if (!l.student)
      l.warnings.push("Dossard inconnu dans la liste des élèves.");
    if (l.action === "set" && l.previousBib)
      l.warnings.push(`Remplace le dossard ${l.previousBib}.`);
    const others = (positionsByBib.get(norm(l.bib)) ?? []).filter(
      (p) => p !== l.position,
    );
    if (others.length)
      l.warnings.push(
        `En double : aussi à l’arrivée n°${others.join(", n°")}.`,
      );
  }

  const lastLinePosition = lines.at(-1)?.position ?? input.start - 1;
  const emptyAfter = ordered
    .filter((f) => f.position > lastLinePosition && !finalBib.get(f.position))
    .map((f) => f.position);

  return {
    lines,
    errors: lines.filter((l) => l.error).length,
    warnings: lines.reduce((n, l) => n + l.warnings.length, 0),
    updated: lines.filter((l) => l.action === "set").length,
    created: lines.filter((l) => l.action === "create").length,
    kept: lines.filter((l) => l.action === "keep").length,
    emptyAfter,
  };
}
