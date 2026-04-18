/**
 * Einmal-Script: legt einen Muster-Steckbrief am Muster-Projekt (isSample: true) an.
 * Werte stammen aus dem Übergabedokument FF Nottuln (BV-0151), strukturiert für
 * das ProjectBriefing-Schema. Idempotent: aktualisiert vorhandenen Steckbrief.
 */
import { PrismaClient, type Prisma } from "@prisma/client";

const prisma = new PrismaClient();

type SeedItem = {
  id: string;
  text: string;
  verantwortlich: string | null;
  done: boolean;
  doneAt?: string | null;
};

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: "apricus-solar-ag" },
  });
  if (!org) throw new Error("Organisation 'apricus-solar-ag' nicht gefunden");

  const project = await prisma.project.findFirst({
    where: { organizationId: org.id, isSample: true },
  });
  if (!project) {
    throw new Error(
      "Muster-Projekt (isSample: true) nicht gefunden — bitte vorher seed-sample-customer.ts ausführen.",
    );
  }

  const naechsteSchritte: SeedItem[] = [
    {
      id: "seed-1",
      text: "Projektordner füllen mit Unterlagen zu dem Projekt",
      verantwortlich: "OVL",
      done: false,
    },
    {
      id: "seed-2",
      text: "Belegungsplan erstellen für die Vorvermarktung der Parzellen",
      verantwortlich: "MT",
      done: false,
    },
    {
      id: "seed-3",
      text: "(Vorläufigen) Projektplan erstellen",
      verantwortlich: "MT",
      done: false,
    },
    {
      id: "seed-4",
      text: "Strategie zu den Nachunternehmern (CWF vs. MKG)",
      verantwortlich: "OVL mit MT nach Projektplan",
      done: false,
    },
    {
      id: "seed-5",
      text: "Liste mit Kontaktdaten erstellen (Excel)",
      verantwortlich: "OVL (Vorlage erstellen)",
      done: false,
    },
    {
      id: "seed-6",
      text: "Nachunternehmerliste erstellen (Excel)",
      verantwortlich: "MT",
      done: false,
    },
  ];

  const data = {
    // Grundinformationen
    akquisiteur: "Oliver vom Lehn",
    groesseKwp: 3322,
    verantwortlichkeit: "Martin Trachniewicz",
    prioritaet: "A",
    richtlinie: "4110",
    anlagentyp: "Freifläche",
    projektbeschreibung:
      "Eine Freifläche in der Stadt Nottuln wurde in Kooperation mit einem Entwickler (Voltec) über die „Milk the Sun“ (MTS)-Plattform entwickelt. Die Anlage wird von MTS vermarktet. Dafür werden voraussichtlich 20–30 noch unbekannte Betreiber vermittelt. Projektpartner ist unsere Projektgesellschaft „Sonnen Solarpark 20233 GmbH“.",
    vorhandeneUnterlagen:
      "Baugenehmigung (vereinfachtes Verfahren), Landschaftlicher Begleitplan, Fotos, Netzzusage",

    // Betriebswirtschaftlich
    stakeholder:
      "Herr Kortmann (Verpächter) — nötigste Kommunikation über Baufortschritte\n" +
      "Milk The Sun (Verkäufer/Vermittler) — keine Kommunikation, ausschließlich BW-Interessen\n" +
      "20–30 unbekannte Betreiber — standardisiertes Reporting, ausschließlich BW-Interessen\n" +
      "Sonnen Solarpark 20233 (intern) — Werkvertragspartner, keine Kommunikation\n" +
      "VOLTEC — verantwortlich für Flächensicherung\n" +
      "Envaris — verantwortlich für die Betriebsführung; Dokumente auf Envaris anmelden",
    ansprechpartner: "OvL (Betreiber: keine Einzelkommunikation)",
    auftragsvolumenEur: 1_500_000,
    bwMeilensteine:
      "Voraussichtliche Meilensteine:\n" +
      "10 % bei Baustart\n" +
      "20 % vollständige Modullieferung\n" +
      "10 % bei Lieferung WR\n" +
      "30 % DC-Seite fertig\n" +
      "20 % Lieferung Kompaktstation\n" +
      "10 % Inbetriebnahme und Dokumentation",

    // Technisch
    netzgebiet: "Westnetz",
    technischeAnnahmen:
      "Modulbelegung nach vbp\n330-kVA-Huawei-Wechselrichter\nAusschließlich Südausrichtung",
    monteurplanung: "Ausschließlich Nachunternehmer",

    // Projektabwicklung
    herausforderungen:
      "Betreiber unbekannt — Reporting für Betreiber nötig (z. B. monatlicher Newsletter)\n" +
      "OvL ist Hauptansprechpartner (kundenseitig)\n" +
      "Abstimmung Feuerwehr offen (vereinfachtes Baugenehmigungsverfahren)\n" +
      "Zurückschneiden (lassen) von Zweigen an der Zufahrt — Gemeinde\n" +
      "Blendgutachten",
    absehbareProbleme: "Bestell- & Beschaffungsprozess",
    informationsIntervall:
      "Bei den Projektleiter-Meetings und beim Erreichen der BW-Meilensteine",
    ersteTodos:
      "Belegungsplan erstellen inkl. Tabelle über Wechselrichter & Module schnellstmöglich (Versand über OvL)\n" +
      "Layouts & vbp abgleichen\n" +
      "Netzanfrage prüfen bzgl. Verlängerung\n" +
      "OvL hinterlegt vorhandene Unterlagen im Projektordner",
    offeneTodosVorStart:
      "Unbedingt: Belegungsplan inkl. Tabelle für die Vermarktung",
    erwartungenKunde: "Bauphase über den Sommer hinweg.",
    ausserordentlicheAbspr:
      "Das Projekt wurde von einem Projektentwickler entwickelt, mit dem wir weitere Projekte in Planung haben. Ein Erfolg ist daher wichtig.",
    sonstigeAnmerkungen:
      "Das Projekt wird von MTS vermarktet, sonst gibt es keine weitere Kommunikation mit MTS.\n" +
      "Die Projektgesellschaft (SPV) steht gegenüber den Betreibern in Haftung. Wir stehen gegenüber der SPV für 2 Jahre in Haftung.\n" +
      "Vertrag mit der Betriebsführung muss noch abgeschlossen werden.\n" +
      "Sperrabstand zur Bahntrasse (15 m?) beachten!\n" +
      "Feuerwehr wurde noch nicht eingebunden.",

    naechsteSchritte: naechsteSchritte as unknown as Prisma.InputJsonValue,
    version: "1.0",
  };

  const briefing = await prisma.projectBriefing.upsert({
    where: { projectId: project.id },
    create: { projectId: project.id, ...data },
    update: data,
  });

  console.log(`Steckbrief gesetzt für Projekt: ${project.name} (${project.projectNumber})`);
  console.log(`  Größe: ${briefing.groesseKwp} kWp, Priorität: ${briefing.prioritaet}, Richtlinie: ${briefing.richtlinie}`);
  console.log(`  Checkliste: ${naechsteSchritte.length} Schritte`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
