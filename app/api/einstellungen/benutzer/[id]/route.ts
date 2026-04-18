/**
 * GET    /api/einstellungen/benutzer/[id]  — Self oder Manager+.
 * PATCH  /api/einstellungen/benutzer/[id]  — Self für eigene Daten;
 *                                            Manager+ für andere (Rolle/Flags
 *                                            nur durch Admin/Developer).
 * DELETE /api/einstellungen/benutzer/[id]  — Admin/Developer, nicht sich selbst.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireSession,
  isAdmin,
  isManagerOrAbove,
} from "@/lib/api-helpers";
import {
  deleteUser,
  getUser,
  updateUser,
  type UpdateUserInput,
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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const isSelf = id === session!.user.id;
  if (!isSelf && !isManagerOrAbove(session!.user.role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  const user = await getUser(session!.user.organizationId, id);
  if (!user) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 },
    );
  }
  return NextResponse.json(user);
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  const isSelf = id === session!.user.id;
  const callerRole = session!.user.role;

  if (!isSelf && !isManagerOrAbove(callerRole)) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  const body = (await req.json()) as Record<string, unknown>;

  const patch: UpdateUserInput = {};

  if (typeof body.name === "string") patch.name = body.name;
  if (typeof body.email === "string") patch.email = body.email;
  if (typeof body.kuerzel === "string") patch.kuerzel = body.kuerzel;
  if (typeof body.position === "string") patch.position = body.position;
  if (typeof body.department === "string") patch.department = body.department;

  // Rolle: nur Admin/Developer, DEVELOPER-Rolle nur von DEVELOPER setzbar
  if (body.role !== undefined) {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen die Rolle ändern" },
        { status: 403 },
      );
    }
    if (!isValidRoleValue(body.role)) {
      return NextResponse.json({ error: "Ungültige Rolle" }, { status: 400 });
    }
    if (body.role === "DEVELOPER" && callerRole !== "DEVELOPER") {
      return NextResponse.json(
        { error: "Keine Berechtigung für Developer-Rolle" },
        { status: 403 },
      );
    }
    patch.role = body.role;
  }

  // isDisabled — niemand darf sich selbst deaktivieren, nur Manager+
  if (typeof body.isDisabled === "boolean") {
    if (isSelf) {
      return NextResponse.json(
        { error: "Du kannst dich nicht selbst deaktivieren" },
        { status: 403 },
      );
    }
    if (!isManagerOrAbove(callerRole)) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 },
      );
    }
    patch.isDisabled = body.isDisabled;
  }

  // Flags: Admin/Developer
  if (typeof body.isExternal === "boolean") {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen dieses Feld ändern" },
        { status: 403 },
      );
    }
    patch.isExternal = body.isExternal;
  }
  if (typeof body.hasAposAccess === "boolean") {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen dieses Feld ändern" },
        { status: 403 },
      );
    }
    patch.hasAposAccess = body.hasAposAccess;
  }
  if (typeof body.hasOosAccess === "boolean") {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen dieses Feld ändern" },
        { status: 403 },
      );
    }
    patch.hasOosAccess = body.hasOosAccess;
  }
  if (typeof body.mobileClockInAllowed === "boolean") {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen dieses Feld ändern" },
        { status: 403 },
      );
    }
    patch.mobileClockInAllowed = body.mobileClockInAllowed;
  }
  if (typeof body.reasonRequiredOnShift === "boolean") {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen dieses Feld ändern" },
        { status: 403 },
      );
    }
    patch.reasonRequiredOnShift = body.reasonRequiredOnShift;
  }
  if (typeof body.isReportRequired === "boolean") {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen dieses Feld ändern" },
        { status: 403 },
      );
    }
    patch.isReportRequired = body.isReportRequired;
  }
  if (typeof body.betaMode === "boolean") {
    if (!isAdmin(callerRole)) {
      return NextResponse.json(
        { error: "Nur Admins dürfen dieses Feld ändern" },
        { status: 403 },
      );
    }
    patch.betaMode = body.betaMode;
  }

  try {
    const updated = await updateUser(session!.user.organizationId, id, patch);
    if (!updated) {
      return NextResponse.json(
        { error: "Benutzer nicht gefunden" },
        { status: 404 },
      );
    }
    return NextResponse.json(updated);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Update fehlgeschlagen";
    const status = message === "E-Mail bereits vergeben" ? 409 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;
  const { id } = await params;

  if (!isAdmin(session!.user.role)) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 },
    );
  }

  if (id === session!.user.id) {
    return NextResponse.json(
      { error: "Du kannst dich nicht selbst löschen" },
      { status: 403 },
    );
  }

  const ok = await deleteUser(session!.user.organizationId, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Benutzer nicht gefunden" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true });
}
