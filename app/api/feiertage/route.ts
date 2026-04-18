import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { createHoliday, listHolidays } from "@/lib/feiertage/service";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const holidays = await listHolidays(session!.user.organizationId);
  return NextResponse.json(holidays);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  const body = (await req.json()) as { date?: unknown; name?: unknown };
  const date = typeof body.date === "string" ? body.date.trim() : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!date || !DATE_KEY_RE.test(date)) {
    return NextResponse.json(
      { error: "Datum ist erforderlich (Format YYYY-MM-DD)" },
      { status: 400 },
    );
  }
  if (!name) {
    return NextResponse.json(
      { error: "Name ist erforderlich" },
      { status: 400 },
    );
  }

  try {
    const holiday = await createHoliday(session!.user.organizationId, {
      date,
      name,
    });
    return NextResponse.json(holiday, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Feiertag konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
