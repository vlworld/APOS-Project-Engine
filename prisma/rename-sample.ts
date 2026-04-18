/**
 * Einmal-Script: benennt das bestehende Muster-Projekt um.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.project.updateMany({
    where: { isSample: true },
    data: {
      name: "Solarpark Wiesau",
      clientName: "MSP Solarpark Wiesau UG",
      address: "95676 Wiesau, Bayern",
    },
  });
  console.log(`Umbenannt: ${result.count} Projekt(e)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
