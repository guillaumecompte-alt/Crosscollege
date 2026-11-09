import { createFileRoute, Link } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  ArrowRight,
  FileSpreadsheet,
  HardDrive,
  ListOrdered,
  Printer,
  Timer,
  Trophy,
} from "lucide-react";
import { AppHeader } from "@/components/app-header";
import { downloadTemplate } from "@/lib/students";

export const Route = createFileRoute("/aide")({
  head: () => ({
    meta: [
      { title: "Mode d’emploi · Cross du collège" },
      {
        name: "description",
        content:
          "Comment préparer la liste, imprimer les dossards, chronométrer le cross et sortir les résultats.",
      },
    ],
  }),
  component: HelpPage,
});

const STEPS = [
  {
    id: "liste",
    icon: FileSpreadsheet,
    title: "Importer la liste",
    when: "Avant",
  },
  {
    id: "dossards",
    icon: Printer,
    title: "Imprimer les dossards",
    when: "Avant",
  },
  { id: "course", icon: Timer, title: "Chronométrer", when: "Jour J" },
  {
    id: "saisie-groupee",
    icon: ListOrdered,
    title: "Saisir les dossards",
    when: "Jour J",
  },
  {
    id: "resultats",
    icon: Trophy,
    title: "Sortir les résultats",
    when: "Après",
  },
] as const;

function Section({
  id,
  number,
  title,
  children,
}: {
  id: string;
  number?: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="help-section">
      <h2>
        {number !== undefined && <span className="help-number">{number}</span>}
        {title}
      </h2>
      <div className="help-body">{children}</div>
    </section>
  );
}

function HelpPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <AppHeader active="help" />
      <main className="page-container help-page pb-16">
        <section className="page-heading pt-10 pb-7">
          <div className="eyebrow">
            <span className="text-primary">?</span>
            <span className="eyebrow-line" /> MODE D’EMPLOI
          </div>
          <h1 className="mt-2">Comment ça marche</h1>
          <p className="text-muted-foreground text-sm mt-2">
            Tout le cross en 5 étapes. Comptez 5 minutes de lecture.
          </p>
        </section>

        <ol className="help-steps">
          {STEPS.map(({ id, icon: Icon, title, when }, i) => (
            <li key={id}>
              <a href={`#${id}`}>
                <span className="help-step-when">{when}</span>
                <Icon size={20} />
                <span className="help-step-title">
                  {i + 1}. {title}
                </span>
              </a>
            </li>
          ))}
        </ol>

        <div className="help-note">
          <HardDrive size={18} className="shrink-0" />
          <p>
            <strong>
              Important : faites tout sur le même ordinateur et le même
              navigateur.
            </strong>{" "}
            Les données (élèves, courses, arrivées) sont enregistrées uniquement
            sur cet appareil, rien n’est envoyé sur internet. Faites une{" "}
            <a href="#sauvegarde" className="help-link">
              sauvegarde
            </a>{" "}
            après chaque étape importante, et ne videz pas les données de
            navigation du site.
          </p>
        </div>

        <Section id="liste" number={1} title="Importer la liste des élèves">
          <ol>
            <li>
              Préparez un fichier Excel avec ces 5 colonnes :{" "}
              <strong>N° dossard</strong>, <strong>Nom</strong>,{" "}
              <strong>Prénom</strong>, <strong>Sexe</strong> (M ou F) et{" "}
              <strong>Classe</strong>.{" "}
              <button
                type="button"
                className="help-link"
                onClick={downloadTemplate}
              >
                Télécharger le modèle Excel
              </button>
            </li>
            <li>
              Dans l’onglet{" "}
              <Link to="/" className="help-link">
                Import Liste
              </Link>
              , déposez le fichier ou cliquez sur « Choisir un fichier ».
            </li>
            <li>
              Si une ligne pose problème (dossard en double, sexe autre que M/F,
              case vide), rien n’est importé et les lignes à corriger
              s’affichent. Corrigez le fichier puis recommencez.
            </li>
          </ol>
          <p className="help-tip">
            Les en-têtes peuvent être dans n’importe quel ordre. Importer un
            nouveau fichier <strong>remplace</strong> la liste précédente (les
            courses et arrivées sont conservées).
          </p>
        </Section>

        <Section id="dossards" number={2} title="Imprimer les dossards">
          <ol>
            <li>
              Toujours dans l’onglet Import Liste, choisissez 2 ou 4 dossards
              par page A4.
            </li>
            <li>
              Pour n’imprimer qu’une classe, filtrez la liste d’abord :{" "}
              <strong>les filtres s’appliquent à l’impression</strong>.
            </li>
            <li>
              Cliquez sur « Générer les dossards PDF », imprimez, découpez le
              long des repères.
            </li>
          </ol>
        </Section>

        <Section
          id="course"
          number={3}
          title="Le jour J : chronométrer une course"
        >
          <ol>
            <li>
              Onglet{" "}
              <Link to="/course" className="help-link">
                Course
              </Link>{" "}
              → « Nouvelle course ». Donnez-lui un titre (ex. « 6e Filles ») et
              une longueur (ex. « 1 800 m ») : la longueur sert à calculer la
              vitesse.
            </li>
            <li>
              Au coup de sifflet, cliquez sur <strong>Départ course</strong>. Le
              chrono tourne, même si vous rechargez la page.
            </li>
            <li>
              À chaque coureur qui franchit la ligne, cliquez sur{" "}
              <strong>Arrivée coureur</strong> ou appuyez sur la touche{" "}
              <kbd className="key-big">²</kbd> (en haut à gauche du clavier). Le
              temps et la place sont enregistrés.
            </li>
            <li>
              Tapez le dossard dans la case de l’arrivée, puis <kbd>Entrée</kbd>
              . Le nom de l’élève s’affiche. Vous pouvez aussi laisser les
              dossards vides et les saisir tous à la fin (étape 4).
            </li>
            <li>
              Quand tout le monde est arrivé, cliquez sur{" "}
              <strong>Fin de course</strong>.
            </li>
          </ol>
          <p className="help-tip">
            Un appui en trop ? Supprimez l’arrivée avec la corbeille au bout de
            sa ligne. « Dossard inconnu » ou « En double » en rouge signale une
            erreur de saisie à corriger.
          </p>
        </Section>

        <Section
          id="saisie-groupee"
          number={4}
          title="Saisir tous les dossards d’un coup"
        >
          <p>
            Pratique quand les élèves arrivent en paquet : une personne appuie
            sur <kbd className="key-big">²</kbd> à chaque arrivée, pendant
            qu’une autre note les dossards dans l’ordre (sur papier, ou en
            ramassant les talons de dossards).
          </p>
          <ol>
            <li>
              Dans l’onglet Course, cliquez sur <strong>Saisie groupée</strong>.
            </li>
            <li>
              Tapez ou collez les dossards{" "}
              <strong>dans l’ordre d’arrivée, un par ligne</strong>. Mettez{" "}
              <kbd>?</kbd> pour un coureur dont le dossard est inconnu : sa
              place est gardée.
            </li>
            <li>
              Vérifiez l’<strong>aperçu</strong> : chaque ligne montre
              l’arrivée, le temps et l’élève reconnu. Les lignes en jaune ou en
              rouge signalent un dossard inconnu, en double ou mal tapé.
            </li>
            <li>
              Cliquez sur <strong>Valider la saisie</strong>. Une erreur ?
              Cliquez sur « Annuler » dans le message qui s’affiche.
            </li>
          </ol>
          <div className="help-example">
            <div>
              <div className="field-label">Exemple</div>
              <pre>{"47\n12\n?\n128"}</pre>
            </div>
            <ArrowRight className="text-muted-foreground shrink-0" />
            <ul>
              <li>Arrivée 1 → dossard 47</li>
              <li>Arrivée 2 → dossard 12</li>
              <li>Arrivée 3 → dossard inconnu</li>
              <li>Arrivée 4 → dossard 128</li>
            </ul>
          </div>
          <ul className="help-list">
            <li>
              <strong>Plus de dossards que d’arrivées</strong> (un appui oublié)
              : les arrivées manquantes sont créées <strong>sans temps</strong>{" "}
              (« — »).
            </li>
            <li>
              <strong>Saisie en plusieurs fois</strong> : choisissez « Commencer
              à l’arrivée n° … ». Par défaut, c’est la première arrivée sans
              dossard.
            </li>
            <li>
              <strong>Dossards déjà saisis</strong> : choisissez de les garder
              (par défaut) ou de les remplacer.
            </li>
            <li>
              <strong>Course sans chrono</strong> : si seul l’ordre compte, ne
              lancez pas le chrono, ouvrez directement la saisie groupée et
              collez la liste dans l’ordre d’arrivée.
            </li>
          </ul>
        </Section>

        <Section id="resultats" number={5} title="Sortir les résultats">
          <ol>
            <li>
              Onglet{" "}
              <Link to="/resultats" className="help-link">
                Résultats
              </Link>{" "}
              → choisissez la course.
            </li>
            <li>
              Le <strong>classement des classes</strong> additionne les places
              des 10 premiers élèves de chaque classe :{" "}
              <strong>le plus petit total gagne</strong>.
            </li>
            <li>
              <strong>Exporter en Excel</strong> : une feuille avec toutes les
              arrivées, une feuille par classe (total en rouge).
            </li>
            <li>
              <strong>Exporter en PDF</strong> : imprimez en{" "}
              <strong>recto-verso, retournement sur le bord long</strong> : les
              arrivées au recto, le classement des classes au verso.
            </li>
          </ol>
        </Section>

        <Section id="sauvegarde" title="Sauvegarder et restaurer">
          <p>
            Le bouton <strong>Sauvegarde</strong>, en haut à droite, crée un
            fichier qui contient tout : élèves, courses et arrivées.
          </p>
          <ul className="help-list">
            <li>
              <strong>Quand ?</strong> Après l’import de la liste, après chaque
              course (un rappel s’affiche à la fin de course), et avant de
              changer d’ordinateur.
            </li>
            <li>
              <strong>Télécharger une sauvegarde</strong> : un fichier{" "}
              <code>cross-college-sauvegarde-date-heure.json</code> arrive dans
              vos téléchargements. Copiez-le sur une clé USB ou un Drive.
            </li>
            <li>
              <strong>Restaurer</strong> : « Choisir un fichier… », vérifiez le
              contenu affiché (nombre d’élèves, de courses, d’arrivées), puis «
              Remplacer mes données ». Attention, tout ce qui est sur
              l’ordinateur est remplacé ; un bouton « Annuler » permet de
              revenir en arrière juste après.
            </li>
            <li>
              <strong>Changer d’ordinateur</strong> : sauvegardez sur l’ancien,
              ouvrez le site sur le nouveau, restaurez.
            </li>
          </ul>
        </Section>

        <Section id="raccourcis" title="Raccourcis clavier">
          <table className="help-keys">
            <tbody>
              <tr>
                <td>
                  <kbd className="key-big">²</kbd>
                </td>
                <td>Enregistrer une arrivée (pendant la course)</td>
              </tr>
              <tr>
                <td>
                  <kbd>Entrée</kbd>
                </td>
                <td>Valider le dossard tapé dans une case</td>
              </tr>
            </tbody>
          </table>
        </Section>
      </main>
    </div>
  );
}
