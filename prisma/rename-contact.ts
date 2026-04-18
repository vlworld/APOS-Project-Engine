/**
 * Einmal-Script: benennt Kontakt + Briefing-Verantwortlichkeit um.
 * Trachniewicz → Matthias La Mendola
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const c = await prisma.customerContact.updateMany({
    where: { lastName: "Trachniewicz" },
    data: { firstName: "Matthias", lastName: "La Mendola" },
  });
  console.log(`Kontakte umbenannt: ${c.count}`);

  // Briefing: verantwortlichkeit aktualisieren
  const b = await prisma.projectBriefing.updateMany({
    where: { verantwortlichkeit: { contains: "Trachniewicz" } },
    data: { verantwortlichkeit: "Matthias La Mendola" },
  });
  console.log(`Briefings angepasst: ${b.count}`);

  // Auch in Checkliste falls referenziert (JSON, manuelles Replace)
  const briefings = await prisma.projectBriefing.findMany({
    where: { naechsteSchritte: { not: null as never } },
  });
  for (const br of briefings) {
    const json = br.naechsteSchritte;
    if (typeof json === "string" && json.includes("Trachniewicz")) {
      const replaced = json.replace(/Trachniewicz/g, "La Mendola");
      await prisma.projectBriefing.update({
        where: { id: br.id },
        data: { naechsteSchritte: replaced },
      });
      console.log(`Checkliste in Briefing ${br.id} aktualisiert`);
    } else if (Array.isArray(json)) {
      const updated = JSON.stringify(json).replace(/Trachniewicz/g, "La Mendola").replace(/Martin/g, "Matthias");
      await prisma.projectBriefing.update({
        where: { id: br.id },
        data: { naechsteSchritte: JSON.parse(updated) },
      });
      console.log(`Checkliste in Briefing ${br.id} aktualisiert`);
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
