import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  Download,
  FileUp,
  LoaderCircle,
  Save,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  downloadBackup,
  parseBackup,
  summarize,
  type BackupSummary,
} from "@/lib/backup";
import {
  getLocalData,
  lastBackupAt,
  replaceAllData,
  type LocalData,
} from "@/lib/local-store";

const dateLabel = (iso: string) =>
  new Date(iso).toLocaleString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

function SummaryLine({ summary }: { summary: BackupSummary }) {
  const plural = (n: number, word: string) =>
    `${n.toLocaleString("fr")} ${word}${n > 1 ? "s" : ""}`;
  return (
    <span>
      {plural(summary.students, "élève")} ({plural(summary.classes, "classe")})
      · {plural(summary.races, "course")} ·{" "}
      {plural(summary.finishes, "arrivée")}
    </span>
  );
}

export function BackupDialog() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<BackupSummary | null>(null);
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [pending, setPending] = useState<{
    data: LocalData;
    summary: BackupSummary;
    fileName: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reading, setReading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setCurrent(summarize(getLocalData()));
      setLastBackup(lastBackupAt());
    }
    setPending(null);
    setError(null);
  }

  function exportNow() {
    const summary = downloadBackup();
    setLastBackup(summary.exportedAt);
    toast.success(
      "Sauvegarde téléchargée. Rangez le fichier en lieu sûr (clé USB, Drive…).",
    );
  }

  async function pickFile(file?: File) {
    if (!file) return;
    setError(null);
    setPending(null);
    setReading(true);
    try {
      if (file.size > 20 * 1024 * 1024)
        throw new Error(
          "Le fichier dépasse 20 Mo : ce n’est pas une sauvegarde.",
        );
      const parsed = parseBackup(await file.text());
      setPending({ ...parsed, fileName: file.name });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fichier illisible.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function restore() {
    if (!pending) return;
    const previous = getLocalData();
    try {
      replaceAllData(pending.data);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "La sauvegarde n’a pas pu être restaurée.",
      );
      return;
    }
    setOpen(false);
    setPending(null);
    toast.success("Sauvegarde restaurée.", {
      duration: 10000,
      action: {
        label: "Annuler",
        onClick: () => {
          replaceAllData(previous);
          toast.info(
            "Restauration annulée : les données précédentes sont revenues.",
          );
        },
      },
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogTrigger asChild>
        <button type="button" className="help-header-link">
          <Save size={15} />
          Sauvegarde
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle>Sauvegarde et restauration</AlertDialogTitle>
          <AlertDialogDescription>
            Les données n’existent que dans ce navigateur. Une sauvegarde est un
            fichier qui contient tout (élèves, courses, arrivées) : gardez-en
            une copie, ou utilisez-la pour passer sur un autre ordinateur.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!pending ? (
          <div className="space-y-4 text-sm">
            <div className="backup-box">
              <div className="font-semibold">Sur cet ordinateur</div>
              <div className="text-muted-foreground mt-1">
                {current && <SummaryLine summary={current} />}
              </div>
              <div className="text-muted-foreground mt-1 text-xs">
                Dernière sauvegarde :{" "}
                {lastBackup ? dateLabel(lastBackup) : "jamais"}
              </div>
              <Button className="mt-3 w-full" onClick={exportNow}>
                <Download />
                Télécharger une sauvegarde (.json)
              </Button>
            </div>

            <div className="backup-box">
              <div className="font-semibold">Restaurer une sauvegarde</div>
              <p className="text-muted-foreground mt-1 text-xs">
                Choisissez un fichier de sauvegarde. Vous verrez son contenu
                avant de confirmer.
              </p>
              <input
                ref={inputRef}
                type="file"
                accept=".json,application/json"
                className="sr-only"
                aria-label="Choisir un fichier de sauvegarde"
                onChange={(e) => void pickFile(e.target.files?.[0])}
              />
              <Button
                variant="outline"
                className="mt-3 w-full"
                onClick={() => inputRef.current?.click()}
                disabled={reading}
              >
                {reading ? (
                  <LoaderCircle className="animate-spin" />
                ) : (
                  <FileUp />
                )}
                Choisir un fichier…
              </Button>
              {error && (
                <p
                  role="alert"
                  className="mt-3 flex gap-2 text-xs text-destructive"
                >
                  <AlertTriangle size={14} className="shrink-0" />
                  {error}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 text-sm">
            <div className="backup-box">
              <div className="font-semibold truncate">{pending.fileName}</div>
              {pending.summary.exportedAt && (
                <div className="text-muted-foreground mt-1 text-xs">
                  Sauvegarde du {dateLabel(pending.summary.exportedAt)}
                </div>
              )}
              <div className="mt-1">
                <SummaryLine summary={pending.summary} />
              </div>
            </div>
            <p className="backup-warning">
              <AlertTriangle size={16} className="shrink-0" />
              <span>
                Toutes les données actuelles de cet ordinateur
                {current ? (
                  <>
                    {" "}
                    (<SummaryLine summary={current} />)
                  </>
                ) : null}{" "}
                seront <strong>remplacées</strong> par cette sauvegarde.
              </span>
            </p>
          </div>
        )}

        <AlertDialogFooter>
          {pending ? (
            <>
              <Button variant="outline" onClick={() => setPending(null)}>
                Retour
              </Button>
              <Button variant="destructive" onClick={restore}>
                Remplacer mes données
              </Button>
            </>
          ) : (
            <AlertDialogCancel>Fermer</AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
