import { useMemo, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, ListOrdered, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  defaultStart,
  planBulk,
  type BulkLine,
  type BulkMode,
} from "@/lib/bulk-bibs";
import {
  applyBulkPlan,
  restoreRaceFinishes,
  type Finish,
} from "@/lib/local-store";
import { formatTime } from "@/lib/results";
import type { Student } from "@/lib/students";

const STATUS: Record<BulkLine["action"], string> = {
  set: "Dossard ajouté",
  same: "Déjà saisi, identique",
  keep: "Déjà saisi, conservé",
  create: "Nouvelle arrivée, sans temps",
  skip: "Coureur non identifié (?)",
};

export function BulkEntry({
  raceId,
  finishes,
  students,
  onClose,
}: {
  raceId: string;
  finishes: Finish[];
  students: Student[];
  onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [start, setStart] = useState(() => defaultStart(finishes));
  const [mode, setMode] = useState<BulkMode>("fill");
  const plan = useMemo(
    () => planBulk({ text, finishes, students, start, mode }),
    [text, finishes, students, start, mode],
  );
  const lastPosition = finishes.at(-1)?.position ?? 0;
  const hasLines = plan.lines.length > 0;

  function validate() {
    if (!hasLines || plan.errors) return;
    const previous = applyBulkPlan(raceId, plan);
    const parts = [
      plan.updated &&
        `${plan.updated} dossard${plan.updated > 1 ? "s" : ""} ajouté${plan.updated > 1 ? "s" : ""}`,
      plan.created &&
        `${plan.created} arrivée${plan.created > 1 ? "s" : ""} créée${plan.created > 1 ? "s" : ""} sans temps`,
    ].filter(Boolean);
    toast.success(
      parts.length
        ? `Saisie enregistrée : ${parts.join(", ")}.`
        : "Aucun changement à enregistrer.",
      {
        duration: 10000,
        action: {
          label: "Annuler",
          onClick: () => {
            restoreRaceFinishes(raceId, previous);
            toast.info("Saisie groupée annulée.");
          },
        },
      },
    );
    setText("");
    onClose();
  }

  return (
    <section className="bulk-panel mt-5" aria-labelledby="bulk-title">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2
            id="bulk-title"
            className="flex items-center gap-2 text-base font-bold"
          >
            <ListOrdered size={18} /> Saisie groupée des dossards
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Tapez ou collez les dossards <strong>dans l’ordre d’arrivée</strong>
            , <strong>un par ligne</strong>. Le 1ᵉʳ dossard va à l’arrivée
            choisie ci-dessous, le 2ᵉ à la suivante, etc. Mettez <kbd>?</kbd>{" "}
            pour un coureur dont le dossard est inconnu.
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Fermer la saisie groupée"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[220px_minmax(0,1fr)]">
        <div>
          <label className="field-label" htmlFor="bulk-text">
            Dossards (un par ligne)
          </label>
          <textarea
            id="bulk-text"
            className="bulk-textarea"
            rows={12}
            spellCheck={false}
            placeholder={"12\n47\n3\n?\n128"}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <label className="field-label mt-3" htmlFor="bulk-start">
            Commencer à l’arrivée n°
            <select
              id="bulk-start"
              className="class-select mt-1.5 block w-full max-w-none"
              value={start}
              onChange={(e) => setStart(Number(e.target.value))}
            >
              {finishes.map((f) => (
                <option key={f.id} value={f.position}>
                  {f.position}
                  {f.bib ? ` (dossard ${f.bib})` : " (sans dossard)"}
                </option>
              ))}
              <option value={lastPosition + 1}>
                {lastPosition + 1} (nouvelles arrivées, sans temps)
              </option>
            </select>
          </label>
          <fieldset className="mt-3 space-y-1.5 text-xs">
            <legend className="field-label mb-1.5">Dossards déjà saisis</legend>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="bulk-mode"
                checked={mode === "fill"}
                onChange={() => setMode("fill")}
              />
              Les garder
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="bulk-mode"
                checked={mode === "replace"}
                onChange={() => setMode("replace")}
              />
              Les remplacer
            </label>
          </fieldset>
        </div>

        <div className="min-w-0">
          <div className="field-label">Aperçu avant validation</div>
          {!hasLines ? (
            <div className="bulk-empty">
              L’aperçu apparaîtra ici dès que vous aurez saisi des dossards.
            </div>
          ) : (
            <>
              <div className="mb-2 flex flex-wrap gap-2 text-[11px] font-semibold">
                <span className="bulk-chip">
                  {plan.lines.length} ligne{plan.lines.length > 1 ? "s" : ""}
                </span>
                {plan.updated > 0 && (
                  <span className="bulk-chip ok">
                    {plan.updated} dossard(s) ajouté(s)
                  </span>
                )}
                {plan.created > 0 && (
                  <span className="bulk-chip">
                    {plan.created} arrivée(s) sans temps
                  </span>
                )}
                {plan.kept > 0 && (
                  <span className="bulk-chip">{plan.kept} conservé(s)</span>
                )}
                {plan.warnings > 0 && (
                  <span className="bulk-chip warn">
                    {plan.warnings} avertissement(s)
                  </span>
                )}
                {plan.errors > 0 && (
                  <span className="bulk-chip error">
                    {plan.errors} erreur(s)
                  </span>
                )}
              </div>
              <div className="table-wrap bulk-preview">
                <table className="student-table">
                  <thead>
                    <tr>
                      <th>LIGNE</th>
                      <th>ARRIVÉE</th>
                      <th>TEMPS</th>
                      <th>DOSSARD</th>
                      <th>ÉLÈVE</th>
                      <th>REMARQUE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.lines.map((l) => (
                      <tr
                        key={l.line}
                        className={
                          l.error
                            ? "bulk-row-error"
                            : l.warnings.length
                              ? "bulk-row-warn"
                              : ""
                        }
                      >
                        <td className="text-muted-foreground">{l.line}</td>
                        <td>
                          <strong>{l.position}</strong>
                        </td>
                        <td className="font-mono">{formatTime(l.elapsedMs)}</td>
                        <td>
                          {l.error ? (
                            <span className="font-mono">{l.raw}</span>
                          ) : (
                            (l.bib ?? "?")
                          )}
                        </td>
                        <td>
                          {l.student ? (
                            <>
                              <strong>
                                {l.student.lastName.toUpperCase()}
                              </strong>{" "}
                              {l.student.firstName}
                              <span className="ml-1.5 text-muted-foreground">
                                {l.student.className}
                              </span>
                            </>
                          ) : null}
                        </td>
                        <td className="text-[11px]">
                          {l.error ? (
                            <span className="inline-flex gap-1 text-destructive">
                              <AlertTriangle size={13} className="shrink-0" />
                              {l.error}
                            </span>
                          ) : (
                            <>
                              <span
                                className={
                                  l.action === "keep"
                                    ? "text-muted-foreground"
                                    : ""
                                }
                              >
                                {STATUS[l.action]}
                              </span>
                              {l.warnings.map((w) => (
                                <span
                                  key={w}
                                  className="flex gap-1 bulk-warning"
                                >
                                  <AlertTriangle
                                    size={13}
                                    className="mt-px shrink-0"
                                  />
                                  {w}
                                </span>
                              ))}
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {plan.emptyAfter.length > 0 && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Arrivées encore sans dossard après votre liste : n°
                  {plan.emptyAfter.slice(0, 15).join(", n°")}
                  {plan.emptyAfter.length > 15 ? "…" : ""}
                </p>
              )}
            </>
          )}
          <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
            {plan.errors > 0 && (
              <span className="mr-auto text-xs text-destructive">
                Corrigez les lignes en rouge pour pouvoir valider.
              </span>
            )}
            <Button variant="outline" onClick={onClose}>
              Fermer
            </Button>
            <Button onClick={validate} disabled={!hasLines || plan.errors > 0}>
              <Check />
              Valider la saisie
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
