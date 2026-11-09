import {
  getLocalData,
  markBackupDone,
  type Finish,
  type LocalData,
  type Race,
  type Roster,
} from "./local-store";
import type { Student } from "./students";

// Backup file: a JSON copy of everything the app stores in this browser
// (students, races, arrivals), to keep a safe copy or move to another computer.

export const BACKUP_APP = "cross-college";
export const BACKUP_FORMAT = 1;

export type BackupFile = {
  app: typeof BACKUP_APP;
  format: typeof BACKUP_FORMAT;
  exportedAt: string;
  data: LocalData;
};

export type BackupSummary = {
  exportedAt: string | null;
  students: number;
  classes: number;
  races: number;
  finishes: number;
};

export function createBackup(data: LocalData, now = new Date()): BackupFile {
  return {
    app: BACKUP_APP,
    format: BACKUP_FORMAT,
    exportedAt: now.toISOString(),
    data,
  };
}

/** File name such as cross-college-sauvegarde-2026-11-09-2047.json (local time). */
export function backupFileName(now = new Date()) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  return `cross-college-sauvegarde-${date}-${pad(now.getHours())}${pad(now.getMinutes())}.json`;
}

export function summarize(
  data: LocalData,
  exportedAt: string | null = null,
): BackupSummary {
  return {
    exportedAt,
    students: data.roster.students.length,
    classes: new Set(data.roster.students.map((s) => s.className)).size,
    races: data.races.length,
    finishes: data.finishes.length,
  };
}

type Fields<K extends string> = Partial<Record<K, unknown>>;
const isObject = <K extends string>(v: unknown): v is Fields<K> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const isString = (v: unknown): v is string => typeof v === "string";
const isNullableString = (v: unknown): v is string | null =>
  v === null || typeof v === "string";

function fail(message: string): never {
  throw new Error(message);
}

function checkStudent(v: unknown, i: number): Student {
  if (
    !isObject<"bib" | "lastName" | "firstName" | "sex" | "className">(v) ||
    !isString(v.bib) ||
    !/^\d+$/.test(v.bib) ||
    !isString(v.lastName) ||
    !isString(v.firstName) ||
    (v.sex !== "M" && v.sex !== "F") ||
    !isString(v.className)
  )
    fail(`Élève n°${i + 1} illisible dans la sauvegarde.`);
  return {
    bib: v.bib,
    lastName: v.lastName,
    firstName: v.firstName,
    sex: v.sex,
    className: v.className,
  };
}

function checkRace(v: unknown, i: number): Race {
  if (
    !isObject<
      "id" | "title" | "distance" | "started_at" | "ended_at" | "created_at"
    >(v) ||
    !isString(v.id) ||
    !isString(v.title) ||
    !isString(v.distance) ||
    !isNullableString(v.started_at) ||
    !isNullableString(v.ended_at) ||
    !isString(v.created_at)
  )
    fail(`Course n°${i + 1} illisible dans la sauvegarde.`);
  return {
    id: v.id,
    title: v.title,
    distance: v.distance,
    started_at: v.started_at,
    ended_at: v.ended_at,
    created_at: v.created_at,
  };
}

function checkFinish(v: unknown, i: number, raceIds: Set<string>): Finish {
  if (
    !isObject<"id" | "race_id" | "position" | "elapsed_ms" | "bib">(v) ||
    !isString(v.id) ||
    !isString(v.race_id) ||
    typeof v.position !== "number" ||
    !(v.elapsed_ms === null || typeof v.elapsed_ms === "number") ||
    !isNullableString(v.bib)
  )
    fail(`Arrivée n°${i + 1} illisible dans la sauvegarde.`);
  if (!raceIds.has(v.race_id))
    fail(`Arrivée n°${i + 1} rattachée à une course absente de la sauvegarde.`);
  return {
    id: v.id,
    race_id: v.race_id,
    position: v.position,
    elapsed_ms: v.elapsed_ms,
    bib: v.bib,
  };
}

/** Reads and checks a backup file. Throws an Error with a French message if it is not usable. */
export function parseBackup(text: string): {
  data: LocalData;
  summary: BackupSummary;
} {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    fail("Ce fichier n’est pas une sauvegarde valide (JSON illisible).");
  }
  if (
    !isObject<"app" | "format" | "exportedAt" | "data">(json) ||
    json.app !== BACKUP_APP
  )
    fail(
      "Ce fichier n’est pas une sauvegarde de l’application Cross du collège.",
    );
  if (json.format !== BACKUP_FORMAT)
    fail(
      "Cette sauvegarde vient d’une version différente de l’application et ne peut pas être restaurée.",
    );
  const d = json.data;
  if (
    !isObject<"roster" | "races" | "finishes">(d) ||
    !isObject<"students" | "sourceFile" | "savedAt">(d.roster) ||
    !Array.isArray(d.races) ||
    !Array.isArray(d.finishes)
  )
    fail("Sauvegarde incomplète : élèves, courses ou arrivées manquants.");
  if (!Array.isArray(d.roster.students))
    fail("Sauvegarde incomplète : liste d’élèves manquante.");

  const roster: Roster = {
    students: d.roster.students.map(checkStudent),
    sourceFile: isString(d.roster.sourceFile) ? d.roster.sourceFile : null,
    savedAt: isString(d.roster.savedAt) ? d.roster.savedAt : null,
  };
  const races = d.races.map(checkRace);
  const raceIds = new Set(races.map((r) => r.id));
  const finishes = d.finishes.map((f, i) => checkFinish(f, i, raceIds));
  const data: LocalData = { version: 1, roster, races, finishes };
  return {
    data,
    summary: summarize(
      data,
      isString(json.exportedAt) ? json.exportedAt : null,
    ),
  };
}

/** Downloads a backup of everything stored in this browser. */
export function downloadBackup() {
  const now = new Date();
  const backup = createBackup(getLocalData(), now);
  const blob = new Blob([JSON.stringify(backup, null, 2)], {
    type: "application/json",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = backupFileName(now);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  markBackupDone(backup.exportedAt);
  return summarize(backup.data, backup.exportedAt);
}
