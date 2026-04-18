import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";

// TODO(apos): Extend with role-based helpers (isAdmin, isManagerOrAbove, etc.)
//             once the APOS role model is defined.

export async function requireSession() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  return { session, error: null };
}

export function isAdmin(role: string | undefined | null): boolean {
  return role === "ADMIN" || role === "DEVELOPER";
}

export function isManagerOrAbove(role: string | undefined | null): boolean {
  return role === "MANAGER" || role === "ADMIN" || role === "DEVELOPER";
}
