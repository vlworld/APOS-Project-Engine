import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { createTradeCategory, listTradeCategories } from "@/lib/gewerke/service";

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const items = await listTradeCategories(session!.user.organizationId);
  return NextResponse.json(items);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  let body: { name?: string; color?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body" }, { status: 400 });
  }

  if (!body.name?.trim() || !body.color?.trim()) {
    return NextResponse.json(
      { error: "Name und Farbe sind pflicht" },
      { status: 400 },
    );
  }

  try {
    const created = await createTradeCategory(session!.user.organizationId, {
      name: body.name,
      color: body.color,
    });
    return NextResponse.json(created, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
