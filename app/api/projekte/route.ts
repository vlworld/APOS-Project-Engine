import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  // TODO(apos-extract): Expand schema with Project model from monorepo, then re-enable.
  // Original: prisma.aposProject.findMany({ where: { organizationId: session.user.organizationId }, include: { manager: true } })
  const projects = await prisma.project.findMany({
    where: { organizationId: session!.user.organizationId },
    include: {
      manager: { select: { id: true, name: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(projects);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = await req.json();
  const { name, projectNumber, managerId, description, startDate, endDate, address, clientName, budget, status } = body;

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
    },
    include: {
      manager: { select: { id: true, name: true, email: true } },
    },
  });

  return NextResponse.json(project, { status: 201 });
}
