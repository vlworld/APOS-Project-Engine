/**
 * APOS Seed-Script
 *
 * Legt die Grundorganisation und initiale Admin-Accounts an. Idempotent:
 * nutzt upsert auf E-Mail. Passwoerter werden mit bcrypt gehasht.
 *
 * Ausfuehren:  npx tsx prisma/seed.ts
 * (oder via package.json prisma.seed-Config)
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // ─── Organisation ─────────────────────────────────────────────────
  const org = await prisma.organization.upsert({
    where: { slug: "apricus-solar-ag" },
    update: {},
    create: {
      name: "Apricus Solar AG",
      slug: "apricus-solar-ag",
    },
  });
  console.log(`Organization: ${org.name} (${org.id})`);

  const defaultPassword = "apricus01";
  const hash = await bcrypt.hash(defaultPassword, 10);

  // ─── Account 1: vomlehn (DEVELOPER, analog zum OOS-Setup) ──
  const vomlehn = await prisma.user.upsert({
    where: { email: "vomlehn@apricus-solar.de" },
    update: {
      role: "DEVELOPER",
      name: "Oliver vom Lehn",
      kuerzel: "OVL",
      hasAposAccess: true,
      hasOosAccess: true,
    },
    create: {
      email: "vomlehn@apricus-solar.de",
      name: "Oliver vom Lehn",
      kuerzel: "OVL",
      role: "DEVELOPER",
      password: hash,
      organizationId: org.id,
      hasOosAccess: true,
      hasAposAccess: true,
    },
  });
  console.log(`User: ${vomlehn.email} (${vomlehn.role})`);

  // ─── Account 2: czaja (ADMIN) ─────────────────────────────────────
  const czaja = await prisma.user.upsert({
    where: { email: "czaja@apricus-solar.de" },
    update: {
      role: "ADMIN",
      name: "Czaja",
      hasAposAccess: true,
      hasOosAccess: true,
    },
    create: {
      email: "czaja@apricus-solar.de",
      name: "Czaja",
      kuerzel: "CZ",
      role: "ADMIN",
      password: hash,
      organizationId: org.id,
      hasOosAccess: true,
      hasAposAccess: true,
    },
  });
  console.log(`User: ${czaja.email} (${czaja.role})`);

  console.log(`\nStart-Passwort fuer beide: "${defaultPassword}"`);
  console.log(`Bitte nach erstem Login aendern.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
