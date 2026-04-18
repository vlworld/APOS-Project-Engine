/**
 * Einmal-Script: legt den Muster-Kunden an und verknüpft ihn mit dem Muster-Projekt.
 * Außerdem: ergänzt Datum-Felder (plannedConstructionStart, plannedCommissioning, deadline)
 * + steeringCommitteeUserIds am Muster-Projekt.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function d(s: string): Date {
  const [y, m, day] = s.split("-").map(Number);
  return new Date(y, m - 1, day);
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: "apricus-solar-ag" },
  });
  if (!org) throw new Error("Organisation nicht gefunden");

  const vomlehn = await prisma.user.findFirst({
    where: { email: "vomlehn@apricus-solar.de" },
  });
  if (!vomlehn) throw new Error("vomlehn@apricus-solar.de nicht gefunden");

  // 1. Muster-Kunde anlegen
  const existingCustomer = await prisma.customer.findFirst({
    where: { organizationId: org.id, companyName: "MSP Solarpark Wiesau UG" },
  });

  let customer;
  if (existingCustomer) {
    customer = existingCustomer;
    console.log(`Kunde bereits vorhanden: ${customer.companyName}`);
  } else {
    customer = await prisma.customer.create({
      data: {
        organizationId: org.id,
        companyName: "MSP Solarpark Wiesau UG",
        legalForm: "UG (haftungsbeschränkt)",
        street: "Industriestraße 12",
        zipCode: "95676",
        city: "Wiesau",
        country: "Deutschland",
        phone: "+49 9634 12345",
        email: "kontakt@msp-wiesau.de",
        website: "https://www.msp-wiesau.de",
        classification: "IMPORTANT",
        notes:
          "Erstes Projekt des Entwicklers. Erfolgreiche Umsetzung ist wichtig für weitere Projekte in Planung.",
        isSample: true,
      },
    });
    console.log(`Kunde angelegt: ${customer.companyName}`);
  }

  // 2. Kontakte
  const existingContacts = await prisma.customerContact.count({
    where: { customerId: customer.id },
  });
  if (existingContacts === 0) {
    await prisma.customerContact.createMany({
      data: [
        {
          customerId: customer.id,
          salutation: "Herr",
          firstName: "Oliver",
          lastName: "vom Lehn",
          role: "Hauptansprechpartner (kundenseitig, MSP)",
          email: "ovl@msp-wiesau.de",
          phone: "+49 170 1234567",
          isPrimary: true,
          notes: "Erstkontakt, Projektleitung operativ",
        },
        {
          customerId: customer.id,
          salutation: "Herr",
          firstName: "Martin",
          lastName: "Trachniewicz",
          role: "Verantwortlich (Projektgesellschaft)",
          email: "mt@msp-wiesau.de",
          notes: "Interne Projektverantwortung Sonnen Solarpark 20233 GmbH",
        },
        {
          customerId: customer.id,
          firstName: null,
          lastName: "Kortmann",
          salutation: "Herr",
          role: "Verpächter",
          notes: "Kommunikation auf das Nötigste zu Baufortschritten beschränken",
        },
      ],
      skipDuplicates: true,
    });
    console.log(`3 Kontakte angelegt`);
  }

  // 3. Muster-Projekt aktualisieren
  const project = await prisma.project.findFirst({
    where: { organizationId: org.id, isSample: true },
  });

  if (project) {
    await prisma.project.update({
      where: { id: project.id },
      data: {
        customerId: customer.id,
        clientName: customer.companyName, // Legacy-Fallback mit aktualisieren
        plannedConstructionStart: d("2025-04-22"),
        plannedCommissioning: d("2025-10-20"),
        deadline: d("2026-03-31"),
        budget: 1_500_000,
        steeringCommitteeUserIds: [vomlehn.id],
      },
    });
    console.log(`Projekt ${project.name} aktualisiert`);
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
