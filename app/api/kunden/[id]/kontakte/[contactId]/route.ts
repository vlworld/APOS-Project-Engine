import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { deleteContact, updateContact } from "@/lib/crm/service";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id: customerId, contactId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const updated = await updateContact(
    session!.user.organizationId,
    customerId,
    contactId,
    body,
  );
  if (!updated) return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
  return NextResponse.json(updated);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; contactId: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id: customerId, contactId } = await params;

  const ok = await deleteContact(session!.user.organizationId, customerId, contactId);
  if (!ok) return NextResponse.json({ error: "Kontakt nicht gefunden" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
