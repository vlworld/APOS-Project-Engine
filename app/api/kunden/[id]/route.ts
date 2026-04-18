import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { deleteCustomer, getCustomer, updateCustomer, getCustomerProjects } from "@/lib/crm/service";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const customer = await getCustomer(session!.user.organizationId, id);
  if (!customer) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });

  const projects = await getCustomerProjects(session!.user.organizationId, id);
  return NextResponse.json({ customer, projects });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  try {
    const updated = await updateCustomer(session!.user.organizationId, id, body);
    if (!updated) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const ok = await deleteCustomer(session!.user.organizationId, id);
  if (!ok) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
