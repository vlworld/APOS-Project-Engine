import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// ─── Projekt-Permissions ────────────────────────────────────────────────────
//
// Reine Permission-Helpers rund um Projekt-Lese- und Schreibrechte.
// Die Pure-Varianten (canReadProjectPure, canWriteProjectPure) sind testbar,
// weil sie nur mit bereits geladenen Entitäten arbeiten.
// Die async-Varianten (canReadProject, canWriteProject) kapseln den DB-Lookup
// und sind für Stellen gedacht, an denen das Projekt ohnehin nicht vorab
// geladen wird. Wer einen API-Handler schreibt, nimmt idealerweise
// `requireProjectAccess` oder `loadProjectIfReadable` — beide liefern das
// Projekt in genau einem Round-Trip.
//
// Rollen-Konvention (User.role):
//   EMPLOYEE   — sieht nur Projekte, bei denen er ProjectMember ist
//   MANAGER    — sieht alle Projekte seiner Organisation (read-only)
//   ADMIN      — voller Zugriff innerhalb der Organisation
//   DEVELOPER  — voller Zugriff innerhalb der Organisation
//
// Schreibrechte hat nur, wer Admin/Developer ist, Projekt-Manager (managerId)
// oder explizit als ProjectMember mit role === "WRITE" eingetragen.

export type SessionUser = {
  id: string;
  organizationId: string;
  role: string;
};

type ProjectCore = {
  organizationId: string;
  managerId: string;
  visibility?: string;
  allowEditByOthers?: boolean;
};

type MemberLite = {
  userId: string;
  role: string;
};

function isAdminLike(role: string): boolean {
  return role === "ADMIN" || role === "DEVELOPER";
}

// ─── Pure Varianten ─────────────────────────────────────────────────────────

export function canReadProjectPure(
  user: SessionUser,
  project: ProjectCore,
  members: ReadonlyArray<MemberLite>,
): boolean {
  // Cross-Organisation strikt blockieren, bevor Rollen ausgewertet werden.
  if (project.organizationId !== user.organizationId) return false;

  if (isAdminLike(user.role)) return true;
  if (project.managerId === user.id) return true;

  const isMember = members.some((m) => m.userId === user.id);
  if (isMember) return true;

  // Manager dürfen Projekte der Org sehen, wenn sie OPEN (Default) sind.
  // RESTRICTED blockiert alle nicht-Mitglieder ausser ADMIN/DEVELOPER.
  if (user.role === "MANAGER") {
    const visibility = project.visibility ?? "OPEN";
    return visibility === "OPEN";
  }

  return false;
}

export function canWriteProjectPure(
  user: SessionUser,
  project: ProjectCore,
  members: ReadonlyArray<MemberLite>,
): boolean {
  if (!canReadProjectPure(user, project, members)) return false;

  if (isAdminLike(user.role)) return true;
  if (project.managerId === user.id) return true;

  const writeMember = members.some(
    (m) => m.userId === user.id && m.role === "WRITE",
  );
  if (writeMember) return true;

  // Manager anderer Projekte duerfen dieses Projekt nur bearbeiten, wenn
  // allowEditByOthers ausdruecklich erlaubt ist.
  if (user.role === "MANAGER" && project.allowEditByOthers === true) {
    const visibility = project.visibility ?? "OPEN";
    if (visibility === "OPEN") return true;
  }

  return false;
}

// ─── DB-Varianten ───────────────────────────────────────────────────────────

async function fetchProjectWithMembers(
  user: SessionUser,
  projectId: string,
): Promise<
  | {
      id: string;
      organizationId: string;
      managerId: string;
      name: string;
      projectNumber: string;
      status: string;
      visibility: string;
      allowEditByOthers: boolean;
      members: Array<{ userId: string; role: string }>;
    }
  | null
> {
  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: user.organizationId },
    include: { members: true },
  });
  if (!project) return null;

  return {
    id: project.id,
    organizationId: project.organizationId,
    managerId: project.managerId,
    name: project.name,
    projectNumber: project.projectNumber,
    status: project.status,
    visibility: project.visibility,
    allowEditByOthers: project.allowEditByOthers,
    members: project.members.map((m) => ({ userId: m.userId, role: m.role })),
  };
}

export async function canReadProject(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  const project = await fetchProjectWithMembers(user, projectId);
  if (!project) throw new Error("Projekt nicht gefunden");
  return canReadProjectPure(user, project, project.members);
}

export async function canWriteProject(
  user: SessionUser,
  projectId: string,
): Promise<boolean> {
  const project = await fetchProjectWithMembers(user, projectId);
  if (!project) throw new Error("Projekt nicht gefunden");
  return canWriteProjectPure(user, project, project.members);
}

export async function loadProjectIfReadable(
  user: SessionUser,
  projectId: string,
): Promise<
  | {
      id: string;
      organizationId: string;
      managerId: string;
      name: string;
      members: Array<{ userId: string; role: string }>;
    }
  | null
> {
  const project = await fetchProjectWithMembers(user, projectId);
  if (!project) return null;
  if (!canReadProjectPure(user, project, project.members)) return null;
  return {
    id: project.id,
    organizationId: project.organizationId,
    managerId: project.managerId,
    name: project.name,
    members: project.members,
  };
}

export async function listReadableProjects(user: SessionUser): Promise<
  Array<{
    id: string;
    name: string;
    projectNumber: string;
    status: string;
    managerId: string;
    visibility: string;
    allowEditByOthers: boolean;
  }>
> {
  // ADMIN/DEVELOPER: alle Projekte der Organisation.
  // MANAGER: alle eigenen/Mitglied-Projekte PLUS alle OPEN-sichtbaren.
  // EMPLOYEE: nur eigene Manager-Projekte oder Projekte als Mitglied.
  const isAdminFull = isAdminLike(user.role);

  const projects = await prisma.project.findMany({
    where: {
      organizationId: user.organizationId,
      ...(isAdminFull
        ? {}
        : user.role === "MANAGER"
          ? {
              OR: [
                { managerId: user.id },
                { members: { some: { userId: user.id } } },
                { visibility: "OPEN" },
              ],
            }
          : {
              OR: [
                { managerId: user.id },
                { members: { some: { userId: user.id } } },
              ],
            }),
    },
    select: {
      id: true,
      name: true,
      projectNumber: true,
      status: true,
      managerId: true,
      visibility: true,
      allowEditByOthers: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  return projects;
}

// ─── Convenience für API-Routes ─────────────────────────────────────────────

type ProjectAccessResult = {
  error: NextResponse | null;
  project: {
    id: string;
    organizationId: string;
    managerId: string;
    name: string;
  } | null;
};

export async function requireProjectAccess(
  user: SessionUser,
  projectId: string,
  minLevel: "read" | "write",
): Promise<ProjectAccessResult> {
  const project = await fetchProjectWithMembers(user, projectId);

  // 404 wenn es das Projekt nicht gibt oder es zu einer anderen Org gehört —
  // wir enthüllen bewusst keine Existenz fremder Projekte.
  if (!project) {
    return {
      error: NextResponse.json(
        { error: "Projekt nicht gefunden" },
        { status: 404 },
      ),
      project: null,
    };
  }

  const allowed =
    minLevel === "write"
      ? canWriteProjectPure(user, project, project.members)
      : canReadProjectPure(user, project, project.members);

  if (!allowed) {
    return {
      error: NextResponse.json(
        { error: "Keine Berechtigung für dieses Projekt" },
        { status: 403 },
      ),
      project: null,
    };
  }

  return {
    error: null,
    project: {
      id: project.id,
      organizationId: project.organizationId,
      managerId: project.managerId,
      name: project.name,
    },
  };
}
