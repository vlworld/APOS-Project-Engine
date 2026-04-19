import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";

export async function GET(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const user = session!.user;
  const organizationId = user.organizationId;
  const isAdminFull = user.role === "ADMIN" || user.role === "DEVELOPER";

  // Scope-Filter (?scope=mine). Default = alles, was der User sehen darf
  // (siehe listReadableProjects). "mine" filtert zusaetzlich auf
  // Manager oder Mitglied.
  const scope = req.nextUrl.searchParams.get("scope");
  const onlyMine = scope === "mine";

  const projects = await prisma.project.findMany({
    where: {
      organizationId,
      ...(onlyMine
        ? {
            OR: [
              { managerId: user.id },
              { members: { some: { userId: user.id } } },
            ],
          }
        : isAdminFull
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
    include: {
      manager: { select: { id: true, name: true, email: true, kuerzel: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const {
    name,
    projectNumber,
    managerId,
    description,
    startDate,
    endDate,
    address,
    clientName,
    budget,
    status,
    visibility,
    allowEditByOthers,
  } = body;

  if (!name?.trim() || !projectNumber?.trim() || !managerId) {
    return NextResponse.json(
      { error: "Name, Projektnummer und Projektleiter sind erforderlich" },
      { status: 400 }
    );
  }

  // TODO(apos-extract): address and clientName/budget not yet in minimal schema — extend as needed.
  void address; void clientName; void budget;

  const project = await prisma.project.create({
    data: {
      name: name.trim(),
      projectNumber: projectNumber.trim(),
      managerId,
      description: description?.trim() || null,
      startDate: startDate ? new Date(startDate) : null,
      endDate: endDate ? new Date(endDate) : null,
      status: status || "PLANNING",
      organizationId: session!.user.organizationId,
      visibility: visibility === "RESTRICTED" ? "RESTRICTED" : "OPEN",
      allowEditByOthers: allowEditByOthers === true,
    },
    include: {
      manager: { select: { id: true, name: true, email: true, kuerzel: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
