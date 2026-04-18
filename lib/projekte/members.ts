import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ─── ProjectMember Service-Layer ────────────────────────────────────────────
//
// Kapselt den DB-Zugriff auf ProjectMember. Berechtigungs-Checks (ist der
// Caller überhaupt berechtigt, Mitglieder zu verwalten?) leben NICHT hier,
// sondern in der Route bzw. in `lib/projekte/permissions.ts`. Dieser Service
// validiert nur die Eingabe-Konsistenz (Role-Enum, Existenz der IDs) und
// setzt Cross-Organisation-Schutz durch indem er projectId + Organisation
// des Users gemeinsam filtert (Caller übergibt projectId, Service darf
// annehmen, dass Zugriff auf dieses Projekt bereits bewiesen ist).

export type ProjectMemberRole = "READ" | "WRITE";

export type ProjectMemberDTO = {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    kuerzel: string | null;
    role: string;
  };
  role: ProjectMemberRole;
  createdAt: Date;
};

export type AddableUserDTO = {
  id: string;
  name: string;
  email: string;
  kuerzel: string | null;
  role: string;
};

const ALLOWED_ROLES: ReadonlyArray<ProjectMemberRole> = ["READ", "WRITE"];

function assertRole(role: string): asserts role is ProjectMemberRole {
  if (!ALLOWED_ROLES.includes(role as ProjectMemberRole)) {
    throw new Error("Ungültige Rolle (erlaubt: READ | WRITE)");
  }
}

function toDTO(m: {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
    kuerzel: string | null;
    role: string;
  };
}): ProjectMemberDTO {
  // role wurde bei allen Schreibpfaden über assertRole validiert.
  // Für Leselasten vertrauen wir dem Schema-Default ("READ") bzw. dem vorher
  // validierten Wert aus addMember/updateMemberRole — fallen andere Werte
  // durch (alte Daten), normalisieren wir defensiv auf "READ".
  const normalizedRole: ProjectMemberRole =
    m.role === "WRITE" ? "WRITE" : "READ";
  return {
    id: m.id,
    userId: m.userId,
    user: {
      id: m.user.id,
      name: m.user.name,
      email: m.user.email,
      kuerzel: m.user.kuerzel,
      role: m.user.role,
    },
    role: normalizedRole,
    createdAt: m.createdAt,
  };
}

export async function listMembers(
  projectId: string,
): Promise<ProjectMemberDTO[]> {
  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          kuerzel: true,
          role: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });
  return members.map(toDTO);
}

export async function addMember(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
): Promise<ProjectMemberDTO> {
  assertRole(role);

  // User muss existieren und zur selben Organisation gehören wie das Projekt.
  const [project, user] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { id: true, organizationId: true, managerId: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, organizationId: true },
    }),
  ]);

  if (!project) throw new Error("Projekt nicht gefunden");
  if (!user) throw new Error("Nutzer nicht gefunden");
  if (user.organizationId !== project.organizationId) {
    throw new Error("Nutzer gehört nicht zur Organisation des Projekts");
  }

  // Der Projekt-Manager wird nicht als reguläres Mitglied geführt —
  // er hat implizit Schreibrechte. Einen separaten Member-Eintrag anzulegen
  // wäre redundant und führt zu doppelten Badges in der UI.
  if (project.managerId === userId) {
    throw new Error("Nutzer ist bereits Projekt-Manager");
  }

  try {
    const created = await prisma.projectMember.create({
      data: { projectId, userId, role },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            kuerzel: true,
            role: true,
          },
        },
      },
    });
    return toDTO(created);
  } catch (err) {
    // Prisma wirft P2002 bei Verletzung von @@unique([projectId, userId]).
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      throw new Error("Nutzer ist bereits Mitglied");
    }
    throw err;
  }
}

export async function updateMemberRole(
  projectId: string,
  userId: string,
  role: ProjectMemberRole,
): Promise<ProjectMemberDTO | null> {
  assertRole(role);

  const existing = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId } },
    select: { id: true },
  });
  if (!existing) return null;

  const updated = await prisma.projectMember.update({
    where: { projectId_userId: { projectId, userId } },
    data: { role },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          kuerzel: true,
          role: true,
        },
      },
    },
  });
  return toDTO(updated);
}

export async function removeMember(
  projectId: string,
  userId: string,
): Promise<boolean> {
  const result = await prisma.projectMember.deleteMany({
    where: { projectId, userId },
  });
  return result.count > 0;
}

export async function listAddableUsers(
  organizationId: string,
  projectId: string,
): Promise<AddableUserDTO[]> {
  // Alle User der Organisation, die weder Projekt-Manager sind noch bereits
  // als ProjectMember eingetragen. isDisabled-User werden ausgeblendet.
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { managerId: true, organizationId: true },
  });
  if (!project) throw new Error("Projekt nicht gefunden");
  if (project.organizationId !== organizationId) {
    throw new Error("Projekt gehört nicht zur Organisation");
  }

  const existingMemberIds = await prisma.projectMember
    .findMany({
      where: { projectId },
      select: { userId: true },
    })
    .then((rows) => rows.map((r) => r.userId));

  const excludedIds = new Set<string>([
    project.managerId,
    ...existingMemberIds,
  ]);

  const users = await prisma.user.findMany({
    where: {
      organizationId,
      isDisabled: false,
      id: { notIn: Array.from(excludedIds) },
    },
    select: {
      id: true,
      name: true,
      email: true,
      kuerzel: true,
      role: true,
    },
    orderBy: { name: "asc" },
  });

  return users;
}
