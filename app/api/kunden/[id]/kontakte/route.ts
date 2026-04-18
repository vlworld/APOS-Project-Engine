import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { addContact } from "@/lib/crm/service";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id: customerId } = await params;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const lastName = typeof body.lastName === "string" ? body.lastName.trim() : "";
  if (!lastName) {
    return NextResponse.json({ error: "Nachname ist pflicht" }, { status: 400 });
  }

  const created = await addContact(session!.user.organizationId, customerId, {
    lastName,
    firstName: typeof body.firstName === "string" ? body.firstName : undefined,
    salutation: typeof body.salutation === "string" ? body.salutation : undefined,
    role: typeof body.role === "string" ? body.role : undefined,
    email: typeof body.email === "string" ? body.email : undefined,
    phone: typeof body.phone === "string" ? body.phone : undefined,
    mobile: typeof body.mobile === "string" ? body.mobile : undefined,
    isPrimary: typeof body.isPrimary === "boolean" ? body.isPrimary : undefined,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  if (!created) return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
  return NextResponse.json(created, { status: 201 });
}
