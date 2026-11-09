import { describe, expect, it } from "vitest";
import { defaultStart, planBulk, type BulkFinish } from "./bulk-bibs";
import type { Student } from "./students";

const students: Student[] = [1, 2, 3, 4, 5].map((n) => ({
  bib: String(n).padStart(3, "0"),
  lastName: `Nom${n}`,
  firstName: `Prénom${n}`,
  sex: "F",
  className: "6e A",
}));
const finish = (position: number, bib: string | null = null): BulkFinish => ({
  id: `f${position}`,
  position,
  elapsed_ms: position * 1000,
  bib,
});

describe("defaultStart", () => {
  it("starts at the first arrival without a bib", () => {
    expect(defaultStart([finish(1, "3"), finish(2), finish(3)])).toBe(2);
  });
  it("starts after the last arrival when all have a bib, or at 1 when there is none", () => {
    expect(defaultStart([finish(1, "3"), finish(2, "4")])).toBe(3);
    expect(defaultStart([])).toBe(1);
  });
});

describe("planBulk", () => {
  it("matches one bib per line with the arrivals, in order", () => {
    const plan = planBulk({
      text: "3\n1\n\n2\n",
      finishes: [finish(1), finish(2), finish(3)],
      students,
      start: 1,
      mode: "fill",
    });
    expect(plan.lines.map((l) => [l.position, l.bib, l.action])).toEqual([
      [1, "3", "set"],
      [2, "1", "set"],
      [3, "2", "set"],
    ]);
    expect(plan.lines[0]?.student?.lastName).toBe("Nom3");
    expect(plan).toMatchObject({
      errors: 0,
      warnings: 0,
      updated: 3,
      created: 0,
    });
  });

  it("creates arrivals without a time when there are more bibs than arrivals", () => {
    const plan = planBulk({
      text: "1\n2\n3",
      finishes: [finish(1)],
      students,
      start: 1,
      mode: "fill",
    });
    expect(plan.lines.map((l) => [l.position, l.action, l.elapsedMs])).toEqual([
      [1, "set", 1000],
      [2, "create", null],
      [3, "create", null],
    ]);
    expect(plan.created).toBe(2);
  });

  it("works without any arrival (race without a clock)", () => {
    const plan = planBulk({
      text: "5\n4",
      finishes: [],
      students,
      start: 1,
      mode: "fill",
    });
    expect(plan.lines.map((l) => [l.position, l.action])).toEqual([
      [1, "create"],
      [2, "create"],
    ]);
  });

  it("keeps bibs already typed in fill mode and replaces them in replace mode", () => {
    const finishes = [finish(1, "4"), finish(2)];
    const fill = planBulk({
      text: "1\n2",
      finishes,
      students,
      start: 1,
      mode: "fill",
    });
    expect(fill.lines.map((l) => l.action)).toEqual(["keep", "set"]);
    expect(fill.kept).toBe(1);
    const replace = planBulk({
      text: "1\n2",
      finishes,
      students,
      start: 1,
      mode: "replace",
    });
    expect(replace.lines.map((l) => l.action)).toEqual(["set", "set"]);
    expect(replace.lines[0]?.warnings[0]).toContain("Remplace le dossard 4");
  });

  it("starts at the chosen arrival and skips gaps left by deleted arrivals", () => {
    const plan = planBulk({
      text: "1\n2",
      finishes: [finish(1, "5"), finish(2), finish(4)],
      students,
      start: 2,
      mode: "fill",
    });
    expect(plan.lines.map((l) => l.position)).toEqual([2, 4]);
  });

  it("accepts ? for an unknown runner and rejects anything else that is not a number", () => {
    const plan = planBulk({
      text: "1\n?\nabc\n-",
      finishes: [finish(1), finish(2)],
      students,
      start: 1,
      mode: "fill",
    });
    expect(plan.lines.map((l) => l.action)).toEqual([
      "set",
      "skip",
      "skip",
      "create",
    ]);
    expect(plan.errors).toBe(1);
    expect(plan.lines[2]?.error).toBeDefined();
  });

  it("warns about unknown bibs and duplicates, including leading zeros", () => {
    const plan = planBulk({
      text: "99\n003",
      finishes: [finish(1), finish(2), finish(3, "3")],
      students,
      start: 1,
      mode: "fill",
    });
    expect(plan.lines[0]?.warnings).toContain(
      "Dossard inconnu dans la liste des élèves.",
    );
    expect(plan.lines[1]?.warnings.join()).toContain("aussi à l’arrivée n°3");
  });

  it("lists arrivals left without a bib after the pasted list", () => {
    const plan = planBulk({
      text: "1",
      finishes: [finish(1), finish(2), finish(3, "2")],
      students,
      start: 1,
      mode: "fill",
    });
    expect(plan.emptyAfter).toEqual([2]);
  });
});
