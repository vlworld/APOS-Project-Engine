/**
 * GET  /api/einstellungen/benutzer  — Liste aller Benutzer der Organisation.
 *                                      EMPLOYEE sieht nur sich selbst.
 * POST /api/einstellungen/benutzer  — Neuen Benutzer anlegen (Admin/Developer).
 */

import { NextRequest, NextResponse } from "next/server";
import { requireSession, isAdmin } from "@/lib/api-helpers";
import {
  createUser,
  getUser,
  listUsers,
  type UserRole,
} from "@/lib/benutzer/service";

const VALID_ROLES: ReadonlyArray<UserRole> = [
  "EMPLOYEE",
  "MANAGER",
  "ADMIN",
  "DEVELOPER",
];

function isValidRoleValue(role: unknown): role is UserRole {
  return typeof role === "string" &&
    (VALID_ROLES as ReadonlyArray<string>).includes(role);
}

export async function GET() {
  const { session, error } = await requireSession();
  if (error) return error;

  const orgId = session!.user.organizationId;
  const role = session!.user.role;

  // EMPLOYEE: nur sich selbst
  if (role === "EMPLOYEE") {
    const me = await getUser(orgId, session!.user.id);
    return NextResponse.json(me ? [me] : []);
  }

  const users = await listUsers(orgId);
  return NextResponse.json(users);
}

export async function POST(req: NextRequest) {
  const { session, error } = await requireSession();
  if (error) return error;

  if (!isAdmin(session!.user.role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name : "";
  const email = typeof body.email === "string" ? body.email : "";

  if (!name.trim() || !email.trim()) {
    return NextResponse.json(
      { error: "Name und E-Mail sind erforderlich" },
      { status: 400 },
    );
  }

  const role =
    body.role !== undefined && isValidRoleValue(body.role) ? body.role : undefined;

  // Nur DEVELOPER darf DEVELOPER-Rolle vergeben
  if (role === "DEVELOPER" && session!.user.role !== "DEVELOPER") {
    return NextResponse.json(
      { error: "Keine Berechtigung für Developer-Rolle" },
      { status: 403 },
    );
  }

  try {
    const user = await createUser(session!.user.organizationId, {
      name,
      email,
      role,
      kuerzel: typeof body.kuerzel === "string" ? body.kuerzel : undefined,
      position: typeof body.position === "string" ? body.position : undefined,
      department:
        typeof body.department === "string" ? body.department : undefined,
      password: typeof body.password === "string" ? body.password : undefined,
      isExternal:
        typeof body.isExternal === "boolean" ? body.isExternal : undefined,
      hasAposAccess:
        typeof body.hasAposAccess === "boolean" ? body.hasAposAccess : undefined,
      hasOosAccess:
        typeof body.hasOosAccess === "boolean" ? body.hasOosAccess : undefined,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Benutzer konnte nicht angelegt werden";
    const status = message === "E-Mail bereits vergeben" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
