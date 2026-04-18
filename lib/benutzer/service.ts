/**
 * Service-Layer für die Benutzer-Verwaltung.
 *
 * Aus dem OOS portiert — ohne Onboarding-/RoleCard-Features, dafür mit den
 * APOS-spezifischen Access-Flags (`hasAposAccess`, `hasOosAccess`).
 *
 * Konvention (siehe CONVENTIONS.md §Service-Layer-Pattern):
 *  - Alle Queries strikt auf `organizationId` gescopt.
 *  - Keine HTTP-Logik hier, nur Business-Regeln und Prisma-Calls.
 *  - Rückgabe via `UserDTO` — niemals Passwort-Hashes.
 */

import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

// ---------- Public Types ----------------------------------------------------

export type UserRole = "EMPLOYEE" | "MANAGER" | "ADMIN" | "DEVELOPER";

const VALID_ROLES: ReadonlyArray<UserRole> = [
  "EMPLOYEE",
  "MANAGER",
  "ADMIN",
  "DEVELOPER",
];

export type UserDTO = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  kuerzel: string | null;
  position: string | null;
  department: string | null;
  image: string | null;
  emailVerified: string | null;
  isExternal: boolean;
  isDisabled: boolean;
  hasOosAccess: boolean;
  hasAposAccess: boolean;
  mobileClockInAllowed: boolean;
  reasonRequiredOnShift: boolean;
  isReportRequired: boolean;
  betaMode: boolean;
  lastSeenAt: string | null;
  createdAt: string;
  updatedAt: string;
  organizationId: string;
};

export type CreateUserInput = {
  name: string;
  email: string;
  role?: UserRole;
  kuerzel?: string;
  position?: string;
  department?: string;
  password?: string; // default "Passwort123!"
  isExternal?: boolean;
  hasAposAccess?: boolean;
  hasOosAccess?: boolean;
};

export type UpdateUserInput = Partial<
  Omit<CreateUserInput, "password" | "email">
> & {
  email?: string;
  isDisabled?: boolean;
  mobileClockInAllowed?: boolean;
  reasonRequiredOnShift?: boolean;
  isReportRequired?: boolean;
  betaMode?: boolean;
  hasAposAccess?: boolean;
  hasOosAccess?: boolean;
};

const DEFAULT_PASSWORD = "Passwort123!";
const BCRYPT_ROUNDS = 12;

// ---------- Mapping ---------------------------------------------------------

type PrismaUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  kuerzel: string | null;
  position: string | null;
  department: string | null;
  image: string | null;
  emailVerified: Date | null;
  isExternal: boolean;
  isDisabled: boolean;
  hasOosAccess: boolean;
  hasAposAccess: boolean;
  mobileClockInAllowed: boolean;
  reasonRequiredOnShift: boolean;
  isReportRequired: boolean;
  betaMode: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  organizationId: string;
};

function toDTO(u: PrismaUser): UserDTO {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role: (VALID_ROLES as ReadonlyArray<string>).includes(u.role)
      ? (u.role as UserRole)
      : "EMPLOYEE",
    kuerzel: u.kuerzel,
    position: u.position,
    department: u.department,
    image: u.image,
    emailVerified: u.emailVerified ? u.emailVerified.toISOString() : null,
    isExternal: u.isExternal,
    isDisabled: u.isDisabled,
    hasOosAccess: u.hasOosAccess,
    hasAposAccess: u.hasAposAccess,
    mobileClockInAllowed: u.mobileClockInAllowed,
    reasonRequiredOnShift: u.reasonRequiredOnShift,
    isReportRequired: u.isReportRequired,
    betaMode: u.betaMode,
    lastSeenAt: u.lastSeenAt ? u.lastSeenAt.toISOString() : null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
    organizationId: u.organizationId,
  };
}

const DTO_SELECT = {
  id: true,
  name: true,
  email: true,
  role: true,
  kuerzel: true,
  position: true,
  department: true,
  image: true,
  emailVerified: true,
  isExternal: true,
  isDisabled: true,
  hasOosAccess: true,
  hasAposAccess: true,
  mobileClockInAllowed: true,
  reasonRequiredOnShift: true,
  isReportRequired: true,
  betaMode: true,
  lastSeenAt: true,
  createdAt: true,
  updatedAt: true,
  organizationId: true,
} as const;

function isValidRole(role: string): role is UserRole {
  return (VALID_ROLES as ReadonlyArray<string>).includes(role);
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizeKuerzel(k: string | undefined | null): string | null {
  if (k === undefined || k === null) return null;
  const trimmed = k.trim().toUpperCase();
  if (!trimmed) return null;
  return trimmed.slice(0, 3);
}

// ---------- CRUD ------------------------------------------------------------

export async function listUsers(organizationId: string): Promise<UserDTO[]> {
  const users = await prisma.user.findMany({
    where: { organizationId },
    select: DTO_SELECT,
    orderBy: { name: "asc" },
  });
  return users.map(toDTO);
}

export async function getUser(
  organizationId: string,
  userId: string,
): Promise<UserDTO | null> {
  const user = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: DTO_SELECT,
  });
  return user ? toDTO(user) : null;
}

export async function createUser(
  organizationId: string,
  input: CreateUserInput,
): Promise<UserDTO> {
  const name = input.name?.trim();
  const email = input.email ? normalizeEmail(input.email) : "";

  if (!name) throw new Error("Name darf nicht leer sein");
  if (!email) throw new Error("E-Mail darf nicht leer sein");

  const role: UserRole =
    input.role && isValidRole(input.role) ? input.role : "EMPLOYEE";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    throw new Error("E-Mail bereits vergeben");
  }

  const passwordPlain =
    input.password && input.password.trim()
      ? input.password.trim()
      : DEFAULT_PASSWORD;
  const hashed = await bcrypt.hash(passwordPlain, BCRYPT_ROUNDS);

  try {
    const created = await prisma.user.create({
      data: {
        organizationId,
        name,
        email,
        role,
        password: hashed,
        kuerzel: normalizeKuerzel(input.kuerzel),
        position: input.position?.trim() || null,
        department: input.department?.trim() || null,
        isExternal: input.isExternal ?? false,
        hasAposAccess: input.hasAposAccess ?? true,
        hasOosAccess: input.hasOosAccess ?? true,
      },
      select: DTO_SELECT,
    });
    return toDTO(created);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("E-Mail bereits vergeben");
    }
    throw err;
  }
}

export async function updateUser(
  organizationId: string,
  userId: string,
  input: UpdateUserInput,
): Promise<UserDTO | null> {
  const existing = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true, email: true },
  });
  if (!existing) return null;

  const data: Prisma.UserUpdateInput = {};

  if (input.name !== undefined) {
    const trimmed = input.name.trim();
    if (!trimmed) throw new Error("Name darf nicht leer sein");
    data.name = trimmed;
  }

  if (input.email !== undefined) {
    const normalized = normalizeEmail(input.email);
    if (!normalized) throw new Error("E-Mail darf nicht leer sein");
    if (normalized !== existing.email) {
      const duplicate = await prisma.user.findUnique({
        where: { email: normalized },
      });
      if (duplicate) {
        throw new Error("E-Mail bereits vergeben");
      }
      data.email = normalized;
    }
  }

  if (input.role !== undefined) {
    if (!isValidRole(input.role)) throw new Error("Ungültige Rolle");
    data.role = input.role;
  }

  if (input.kuerzel !== undefined) {
    data.kuerzel = normalizeKuerzel(input.kuerzel);
  }

  if (input.position !== undefined) {
    data.position = input.position?.trim() || null;
  }

  if (input.department !== undefined) {
    data.department = input.department?.trim() || null;
  }

  if (input.isExternal !== undefined) {
    data.isExternal = input.isExternal;
    if (!input.isExternal) {
      data.isReportRequired = false;
    }
  }

  if (input.isDisabled !== undefined) data.isDisabled = input.isDisabled;
  if (input.hasAposAccess !== undefined)
    data.hasAposAccess = input.hasAposAccess;
  if (input.hasOosAccess !== undefined) data.hasOosAccess = input.hasOosAccess;
  if (input.mobileClockInAllowed !== undefined)
    data.mobileClockInAllowed = input.mobileClockInAllowed;
  if (input.reasonRequiredOnShift !== undefined)
    data.reasonRequiredOnShift = input.reasonRequiredOnShift;
  if (input.isReportRequired !== undefined)
    data.isReportRequired = input.isReportRequired;
  if (input.betaMode !== undefined) data.betaMode = input.betaMode;

  if (Object.keys(data).length === 0) {
    const current = await prisma.user.findUnique({
      where: { id: userId },
      select: DTO_SELECT,
    });
    return current ? toDTO(current) : null;
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: DTO_SELECT,
    });
    return toDTO(updated);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("E-Mail bereits vergeben");
    }
    throw err;
  }
}

export async function deleteUser(
  organizationId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.user.deleteMany({
    where: { id: userId, organizationId },
  });
  return result.count > 0;
}

export async function resetPassword(
  organizationId: string,
  userId: string,
  newPassword: string,
): Promise<boolean> {
  const trimmed = newPassword?.trim();
  if (!trimmed) throw new Error("Passwort darf nicht leer sein");
  if (trimmed.length < 6) throw new Error("Passwort muss mindestens 6 Zeichen haben");

  const existing = await prisma.user.findFirst({
    where: { id: userId, organizationId },
    select: { id: true },
  });
  if (!existing) return false;

  const hashed = await bcrypt.hash(trimmed, BCRYPT_ROUNDS);
  await prisma.user.update({
    where: { id: userId },
    data: { password: hashed },
  });
  return true;
}
