import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";

// TODO(apos-extract): This route uses models not yet in the minimal APOS schema.
// Original source: apps/apos/app/api/projekte/[id]/budget/[budgetId]/route.ts
// Re-enable and adapt the Prisma queries once the full schema is expanded.

export async function GET(_req: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const { error } = await requireSession();
  if (error) return error;
  void params;
  return NextResponse.json({ message: "TODO(apos-extract): implement with own schema" }, { status: 501 });
}

export async function POST(req: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const { error } = await requireSession();
  if (error) return error;
  void req; void params;
  return NextResponse.json({ message: "TODO(apos-extract): implement with own schema" }, { status: 501 });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const { error } = await requireSession();
  if (error) return error;
  void req; void params;
  return NextResponse.json({ message: "TODO(apos-extract): implement with own schema" }, { status: 501 });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<Record<string, string>> }) {
  const { error } = await requireSession();
  if (error) return error;
  void params;
  return NextResponse.json({ message: "TODO(apos-extract): implement with own schema" }, { status: 501 });
}
