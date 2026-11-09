import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CircleHelp,
  Flag,
  ListOrdered,
  LoaderCircle,
  Play,
  Plus,
  Square,
  Trash2,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AppHeader } from "@/components/app-header";
import { BulkEntry } from "@/components/bulk-entry";
import { formatTime } from "@/lib/results";
import {
  addFinish,
  createRace,
  deleteRace as deleteLocalRace,
  finishesOf,
  racesOf,
  removeFinish as removeLocalFinish,
  setFinishBib,
  updateRace as updateLocalRace,
  useLocalData,
  type Finish,
  type Race,
} from "@/lib/local-store";

export const Route = createFileRoute("/course")({
  head: () => ({
    meta: [
      { title: "Course · Cross du collège" },
      {
        name: "description",
        content:
          "Chronométrez le cross du collège et enregistrez l’ordre d’arrivée des coureurs.",
      },
      { property: "og:title", content: "Course · Cross du collège" },
      {
        property: "og:description",
        content: "Départ, arrivées et temps de chaque coureur du cross.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CoursePage,
});

const ARRIVAL_KEY = "²";

function CoursePage() {
  const local = useLocalData();
  const races = racesOf(local);
  const [raceId, setRaceId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const race = races.find((r) => r.id === raceId) ?? races[0];
  const list = finishesOf(local, race?.id);
  const [now, setNow] = useState(Date.now());
  const [title, setTitle] = useState("");
  const [distance, setDistance] = useState("");

  // Reset the editable fields only when another race is selected, not while typing.
  useEffect(() => {
    setTitle(race?.title ?? "");
    setDistance(race?.distance ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [race?.id]);
  const running = !!race?.started_at && !race.ended_at;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(t);
  }, [running]);

  const byBib = useMemo(
    () =>
      new Map(
        (local?.roster.students ?? []).map((s) => [
          s.bib.replace(/^0+(?=\d)/, ""),
          s,
        ]),
      ),
    [local?.roster],
  );
  const find = (bib: string | null) =>
    bib ? byBib.get(bib.trim().replace(/^0+(?=\d)/, "")) : undefined;
  const bibCount = useMemo(() => {
    const m = new Map<string, number>();
    list.forEach((f) => {
      if (f.bib) {
        const k = f.bib.replace(/^0+(?=\d)/, "");
        m.set(k, (m.get(k) ?? 0) + 1);
      }
    });
    return m;
  }, [list]);

  const elapsed = race?.started_at
    ? (race.ended_at ? Date.parse(race.ended_at) : now) -
      Date.parse(race.started_at)
    : 0;

  function newRace() {
    setRaceId(createRace().id);
    setBulkOpen(false);
  }
  function updateRace(patch: Partial<Race>) {
    if (race) updateLocalRace(race.id, patch);
  }
  function start() {
    updateRace({ started_at: new Date().toISOString(), ended_at: null });
  }
  function stop() {
    if (confirm("Arrêter le chrono ? La course sera terminée."))
      updateRace({ ended_at: new Date().toISOString() });
  }
  function arrival() {
    if (!race?.started_at) return;
    addFinish(race.id, Date.now() - Date.parse(race.started_at));
  }

  // Keyboard shortcut: the ² key (top-left on French keyboards) records an
  // arrival, even while a bib field has focus. Held keys don't repeat.
  const [keyFlash, setKeyFlash] = useState(false);
  const startedAt = race?.started_at;
  const runningRaceId = running ? race?.id : undefined;
  useEffect(() => {
    if (!runningRaceId || !startedAt) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== ARRIVAL_KEY && event.code !== "Backquote") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      const typing =
        target?.closest("input, textarea, select, [contenteditable]") &&
        !target.classList.contains("bib-input");
      if (typing) return;
      event.preventDefault();
      if (event.repeat) return;
      addFinish(runningRaceId, Date.now() - Date.parse(startedAt));
      setKeyFlash(true);
      window.setTimeout(() => setKeyFlash(false), 150);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [runningRaceId, startedAt]);
  function setBib(f: Finish, bib: string) {
    const value = bib.trim() || null;
    if (value !== f.bib) setFinishBib(f.id, value);
  }
  function removeFinish(f: Finish) {
    if (confirm(`Supprimer l’arrivée n°${f.position} ?`))
      removeLocalFinish(f.id);
  }
  function deleteRace() {
    if (
      !race ||
      !confirm(
        `Supprimer la course « ${race.title || "Course sans titre"} » et toutes ses arrivées ? Cette action est définitive.`,
      )
    )
      return;
    deleteLocalRace(race.id);
    setRaceId(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader active="course" />
      <main className="page-container pb-12">
        <section className="page-heading pt-10 pb-7">
          <div className="eyebrow">
            <span className="text-primary">02</span>
            <span className="eyebrow-line" /> LE JOUR J
          </div>
          <h1 className="mt-2">La course</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Lancez le chrono, enregistrez chaque arrivée (bouton ou touche ²),
            puis saisissez les dossards un par un ou tous d’un coup.{" "}
            <Link to="/aide" hash="course" className="help-link">
              <CircleHelp size={14} /> Comment ça marche ?
            </Link>
          </p>
        </section>

        {!local && (
          <div className="loading-strip">
            <LoaderCircle className="animate-spin" size={18} /> Chargement des
            courses…
          </div>
        )}

        {local && !race && (
          <div className="table-wrap empty-list">
            <Flag className="empty-list-icon" size={34} />
            <h3>Aucune course pour l’instant</h3>
            <p>Créez une course pour commencer.</p>
            <Button className="mt-4" onClick={newRace}>
              <Plus />
              Nouvelle course
            </Button>
          </div>
        )}

        {local && race && (
          <>
            <div className="flex flex-wrap items-center gap-2 mb-5">
              <select
                className="class-select"
                style={{ maxWidth: 260 }}
                value={race.id}
                onChange={(e) => {
                  setRaceId(e.target.value);
                  setBulkOpen(false);
                }}
                aria-label="Choisir la course"
              >
                {races.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.title || "Course sans titre"}
                    {r.distance ? ` · ${r.distance}` : ""}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={newRace}>
                <Plus />
                Nouvelle course
              </Button>
              <Button
                variant={bulkOpen ? "secondary" : "outline"}
                size="sm"
                onClick={() => setBulkOpen((open) => !open)}
                aria-expanded={bulkOpen}
              >
                <ListOrdered />
                Saisie groupée
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive border-destructive/40 ml-auto"
                onClick={deleteRace}
              >
                <Trash2 />
                Supprimer la course
              </Button>
            </div>

            <div className="grid gap-4 sm:grid-cols-[2fr_1fr] mb-5">
              <label className="field-label">
                Titre de la course
                <Input
                  value={title}
                  placeholder="Ex. 6e Filles"
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={() => title !== race.title && updateRace({ title })}
                />
              </label>
              <label className="field-label">
                Longueur
                <Input
                  value={distance}
                  placeholder="Ex. 1 800 m"
                  onChange={(e) => setDistance(e.target.value)}
                  onBlur={() =>
                    distance !== race.distance && updateRace({ distance })
                  }
                />
              </label>
            </div>

            <div className="race-panel">
              <div>
                <div className="stat-label">
                  {race.ended_at
                    ? "COURSE TERMINÉE"
                    : running
                      ? "CHRONO EN COURS"
                      : "PRÊT AU DÉPART"}
                </div>
                <div className={`race-clock ${running ? "running" : ""}`}>
                  {formatTime(elapsed)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {list.length} arrivée{list.length > 1 ? "s" : ""}
                </div>
              </div>
              <div className="race-actions">
                <Button size="lg" onClick={start} disabled={!!race.started_at}>
                  <Play />
                  Départ course
                </Button>
                <div className="arrival-wrap">
                  <span className="key-hint" aria-hidden="true">
                    Raccourci : touche <kbd>{ARRIVAL_KEY}</kbd>
                  </span>
                  <Button
                    size="lg"
                    className={`arrival-btn ${keyFlash ? "key-pressed" : ""}`}
                    onClick={arrival}
                    disabled={!running}
                    aria-keyshortcuts={ARRIVAL_KEY}
                    title={`Raccourci clavier : touche ${ARRIVAL_KEY}`}
                  >
                    <UserCheck />
                    Arrivée coureur
                  </Button>
                </div>
                <Button
                  size="lg"
                  variant="destructive"
                  onClick={stop}
                  disabled={!running}
                >
                  <Square />
                  Fin de course
                </Button>
              </div>
            </div>

            {bulkOpen && (
              <BulkEntry
                key={race.id}
                raceId={race.id}
                finishes={list}
                students={local.roster.students}
                onClose={() => setBulkOpen(false)}
              />
            )}

            <div className="table-wrap mt-5">
              <table className="student-table">
                <thead>
                  <tr>
                    <th>ARRIVÉE</th>
                    <th>TEMPS</th>
                    <th>DOSSARD</th>
                    <th>NOM & PRÉNOM</th>
                    <th>SEXE</th>
                    <th>CLASSE</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="text-center text-muted-foreground py-8"
                      >
                        Les arrivées apparaîtront ici.
                      </td>
                    </tr>
                  )}
                  {[...list].reverse().map((f) => {
                    const s = find(f.bib);
                    const dup =
                      f.bib &&
                      (bibCount.get(f.bib.replace(/^0+(?=\d)/, "")) ?? 0) > 1;
                    return (
                      <tr key={f.id}>
                        <td>
                          <strong className="race-pos">{f.position}</strong>
                        </td>
                        <td className="font-mono">
                          {formatTime(f.elapsed_ms)}
                        </td>
                        <td>
                          <BibInput finish={f} onSave={setBib} />
                        </td>
                        <td>
                          {s ? (
                            <>
                              <strong>{s.lastName.toUpperCase()}</strong>
                              <span className="ml-2 text-muted-foreground">
                                {s.firstName}
                              </span>
                            </>
                          ) : f.bib ? (
                            <span className="text-destructive inline-flex items-center gap-1">
                              <AlertTriangle size={13} />
                              Dossard inconnu
                            </span>
                          ) : null}
                          {dup && (
                            <span className="text-destructive inline-flex items-center gap-1 ml-2">
                              <AlertTriangle size={13} />
                              En double
                            </span>
                          )}
                        </td>
                        <td>
                          {s && (
                            <span
                              className={`sex-tag ${s.sex === "F" ? "female" : "male"}`}
                            >
                              {s.sex}
                            </span>
                          )}
                        </td>
                        <td>{s?.className}</td>
                        <td>
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Supprimer l’arrivée ${f.position}`}
                            onClick={() => removeFinish(f)}
                          >
                            <Trash2 />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function BibInput({
  finish,
  onSave,
}: {
  finish: Finish;
  onSave: (f: Finish, bib: string) => void;
}) {
  const [value, setValue] = useState(finish.bib ?? "");
  useEffect(() => setValue(finish.bib ?? ""), [finish.bib]);
  return (
    <Input
      className="bib-input"
      inputMode="numeric"
      placeholder="N°"
      value={value}
      autoFocus={!finish.bib}
      onChange={(e) => setValue(e.target.value.replace(/\D/g, ""))}
      onBlur={() => onSave(finish, value)}
      onKeyDown={(e) => {
        if (e.key === "Enter") (e.target as HTMLInputElement).blur();
      }}
      aria-label={`Dossard de l’arrivée ${finish.position}`}
    />
  );
}
