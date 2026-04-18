import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { createCustomer, listCustomers } from "@/lib/crm/service";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;
  const items = await listCustomers(session!.user.organizationId);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  const companyName = typeof body.companyName === "string" ? body.companyName.trim() : "";
  if (!companyName) {
    return NextResponse.json({ error: "Firmenname ist pflicht" }, { status: 400 });
  }

  try {
    const created = await createCustomer(session!.user.organizationId, {
      companyName,
      legalForm: typeof body.legalForm === "string" ? body.legalForm : undefined,
      street: typeof body.street === "string" ? body.street : undefined,
      zipCode: typeof body.zipCode === "string" ? body.zipCode : undefined,
      city: typeof body.city === "string" ? body.city : undefined,
      country: typeof body.country === "string" ? body.country : undefined,
      website: typeof body.website === "string" ? body.website : undefined,
      phone: typeof body.phone === "string" ? body.phone : undefined,
      email: typeof body.email === "string" ? body.email : undefined,
      taxId: typeof body.taxId === "string" ? body.taxId : undefined,
      vatId: typeof body.vatId === "string" ? body.vatId : undefined,
      classification: typeof body.classification === "string"
        ? (body.classification as "STANDARD" | "IMPORTANT" | "STRATEGIC" | "WATCH" | "BLOCKED")
        : "STANDARD",
      notes: typeof body.notes === "string" ? body.notes : undefined,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
