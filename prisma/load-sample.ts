/**
 * Einmal-Script: lädt die Muster-Daten in die Apricus-Organisation.
 * Ausführen: npx tsx prisma/load-sample.ts
 */
import { PrismaClient } from "@prisma/client";
import { applyMusterData } from "../lib/muster/service";

const prisma = new PrismaClient();

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: "apricus-solar-ag" },
  });
  if (!org) throw new Error("Organisation 'apricus-solar-ag' nicht gefunden");

  const manager = await prisma.user.findFirst({
    where: { email: "vomlehn@apricus-solar.de" },
  });
  if (!manager) throw new Error("User vomlehn@apricus-solar.de nicht gefunden");

  console.log(`Lade Musterdaten in Organisation: ${org.name}`);
  console.log(`Manager: ${manager.name} (${manager.email})`);

  const status = await applyMusterData(org.id, manager.id);

  console.log(`\nFertig!`);
  console.log(`  Gewerke:      ${status.counts.tradeCategories}`);
  console.log(`  Feiertage:    ${status.counts.holidays}`);
  console.log(`  Projekte:     ${status.counts.projects}`);
  console.log(`  Arbeitspakete: ${status.counts.scheduleItems}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
