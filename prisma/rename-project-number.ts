/**
 * Einmal-Script: setzt die Projekt-Nummer des Muster-Projekts auf die echte
 * Apricus-Nummer (BV-0201 = MSP Wiesau).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const updated = await prisma.project.updateMany({
    where: { isSample: true },
    data: {
      projectNumber: "BV_0201-FFA_Solarpark Wiesau",
    },
  });
  console.log(`Umbenannt: ${updated.count} Projekt(e) → BV_0201-FFA_Solarpark Wiesau`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
