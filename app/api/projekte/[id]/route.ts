import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireSession } from "@/lib/api-helpers";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  // TODO(apos-extract): Expand with _count for sub-models once schema includes them.
  // Original counted: workPackages, scheduleItems, vobItems, budgetItems, risks,
  //                   documents, procurements, stakeholders, decisions, handoverProtocols, communicationLogs
  const project = await prisma.project.findFirst({
    where: { id, organizationId: session!.user.organizationId },
    include: {
      manager: { select: { id: true, name: true, email: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: "Projekt nicht gefunden" }, { status: 404 });
  }

  return NextResponse.json(project);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const body = await req.json();

  await prisma.project.updateMany({
    where: { id, organizationId: session!.user.organizationId },
    data: {
      ...(body.name !== undefined && { name: body.name.trim() }),
      ...(body.projectNumber !== undefined && { projectNumber: body.projectNumber.trim() }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.description !== undefined && { description: body.description?.trim() || null }),
      ...(body.startDate !== undefined && { startDate: body.startDate ? new Date(body.startDate) : null }),
      ...(body.endDate !== undefined && { endDate: body.endDate ? new Date(body.endDate) : null }),
      ...(body.managerId !== undefined && { managerId: body.managerId }),
      ...(body.clientName !== undefined && { clientName: body.clientName?.trim() || null }),
      ...(body.address !== undefined && { address: body.address?.trim() || null }),
      ...(body.budget !== undefined && { budget: body.budget }),
      ...(body.customerId !== undefined && { customerId: body.customerId || null }),
      ...(body.plannedConstructionStart !== undefined && {
        plannedConstructionStart: body.plannedConstructionStart ? new Date(body.plannedConstructionStart) : null,
      }),
      ...(body.plannedCommissioning !== undefined && {
        plannedCommissioning: body.plannedCommissioning ? new Date(body.plannedCommissioning) : null,
      }),
      ...(body.deadline !== undefined && {
        deadline: body.deadline ? new Date(body.deadline) : null,
      }),
      ...(body.dataRoomUrl !== undefined && { dataRoomUrl: body.dataRoomUrl?.trim() || null }),
      ...(body.customerDataRoomUrl !== undefined && { customerDataRoomUrl: body.customerDataRoomUrl?.trim() || null }),
      ...(body.steeringCommitteeUserIds !== undefined && {
        steeringCommitteeUserIds: Array.isArray(body.steeringCommitteeUserIds) ? body.steeringCommitteeUserIds : [],
      }),
    },
  });

  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  await prisma.project.deleteMany({
    where: { id, organizationId: session!.user.organizationId },
  });

  return NextResponse.json({ success: true });
}
