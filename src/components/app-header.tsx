import { Link } from "@tanstack/react-router";
import { FileSpreadsheet, Flag, HardDrive, Timer, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AppHeader({
  active,
}: {
  active: "import" | "course" | "results";
}) {
  return (
    <header className="site-header bg-card border-b border-border">
      <div className="page-container flex items-center justify-between gap-4 py-5">
        <Link
          to="/"
          className="flex items-center gap-3"
          aria-label="Cross du collège, accueil"
        >
          <span className="brand-icon">
            <Flag size={23} strokeWidth={2.3} />
          </span>
          <div className="leading-tight">
            <span className="brand-title">
              CROSS<span className="text-primary">.</span>
            </span>
            <span className="block text-[11px] font-semibold text-muted-foreground mt-1">
              DU COLLÈGE
            </span>
          </div>
        </Link>
        <span
          className="account-chip"
          title="Les données restent dans ce navigateur, sur cet ordinateur. Rien n’est envoyé sur internet."
        >
          <HardDrive size={12} className="shrink-0" />
          Données locales
        </span>
      </div>
      <nav
        className="page-container flex gap-5 sm:gap-10"
        aria-label="Étapes du cross"
      >
        <Button
          asChild
          variant="ghost"
          className={`nav-tab ${active === "import" ? "active" : ""}`}
        >
          <Link to="/">
            <FileSpreadsheet />
            <span>Import Liste</span>
            <span className="step-number">01</span>
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className={`nav-tab ${active === "course" ? "active" : ""}`}
        >
          <Link to="/course">
            <Timer />
            <span>Course</span>
            <span className="step-number">02</span>
          </Link>
        </Button>
        <Button
          asChild
          variant="ghost"
          className={`nav-tab ${active === "results" ? "active" : ""}`}
        >
          <Link to="/resultats">
            <Trophy />
            <span>Résultats</span>
            <span className="step-number">03</span>
          </Link>
        </Button>
      </nav>
    </header>
  );
}
