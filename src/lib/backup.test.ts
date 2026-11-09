import { describe, expect, it } from "vitest";
import { backupFileName, createBackup, parseBackup } from "./backup";
import type { LocalData } from "./local-store";

const data: LocalData = {
  version: 1,
  roster: {
    students: [
      {
        bib: "007",
        lastName: "Martin",
        firstName: "Léa",
        sex: "F",
        className: "6e A",
      },
      {
        bib: "12",
        lastName: "Durand",
        firstName: "Hugo",
        sex: "M",
        className: "6e B",
      },
    ],
    sourceFile: "liste.xlsx",
    savedAt: "2026-11-09T19:00:00.000Z",
  },
  races: [
    {
      id: "r1",
      title: "6e",
      distance: "1500 m",
      started_at: "2026-11-09T10:00:00.000Z",
      ended_at: null,
      created_at: "2026-11-09T09:00:00.000Z",
    },
  ],
  finishes: [
    { id: "f1", race_id: "r1", position: 1, elapsed_ms: 400000, bib: "7" },
    { id: "f2", race_id: "r1", position: 2, elapsed_ms: null, bib: null },
  ],
};

describe("backup", () => {
  it("restores exactly what was exported", () => {
    const text = JSON.stringify(
      createBackup(data, new Date("2026-11-09T19:47:00Z")),
    );
    const { data: restored, summary } = parseBackup(text);
    expect(restored).toEqual(data);
    expect(summary).toEqual({
      exportedAt: "2026-11-09T19:47:00.000Z",
      students: 2,
      classes: 2,
      races: 1,
      finishes: 2,
    });
  });

  it("names the file with the local date and time", () => {
    expect(backupFileName(new Date(2026, 10, 9, 20, 47))).toBe(
      "cross-college-sauvegarde-2026-11-09-2047.json",
    );
  });

  it("rejects files that are not a backup of this app", () => {
    expect(() => parseBackup("pas du json")).toThrow("JSON illisible");
    expect(() => parseBackup(JSON.stringify({ hello: 1 }))).toThrow(
      "Cross du collège",
    );
    expect(() =>
      parseBackup(JSON.stringify({ ...createBackup(data), format: 99 })),
    ).toThrow("version différente");
  });

  it("rejects damaged content with a clear message", () => {
    const broken = createBackup(structuredClone(data));
    (broken.data.roster.students[1] as { sex: string }).sex = "X";
    expect(() => parseBackup(JSON.stringify(broken))).toThrow("Élève n°2");

    const orphan = createBackup({
      ...data,
      finishes: [{ ...data.finishes[0]!, race_id: "absente" }],
    });
    expect(() => parseBackup(JSON.stringify(orphan))).toThrow("course absente");
  });
});
