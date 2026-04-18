import { PrismaClient } from "@prisma/client";

// TODO(apos): Once the APOS database is provisioned and schema is fully expanded,
//             remove this comment and configure DATABASE_URL in .env accordingly.

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
