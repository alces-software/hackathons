import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { createSession } from "@/lib/session";

type LoginRequest = { displayName?: string; password?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LoginRequest;
    const displayName = body.displayName?.trim() ?? "";
    const password = body.password ?? "";
    if (!displayName || !password) {
      return NextResponse.json({ error: "Enter your name and password." }, { status: 400 });
    }

    const connection = await getDbPool().getConnection();
    try {
      const rows = await connection.query(
        "SELECT id, display_name, password_hash, bookie_username FROM users WHERE LOWER(display_name) = LOWER(?)",
        [displayName],
      ) as Array<{ id: number; display_name: string; password_hash: string | null; bookie_username: string | null }>;
      const user = rows[0];
      if (!user || !user.password_hash || !verifyPassword(password, user.password_hash)) {
        return NextResponse.json({ error: "Wrong name or password." }, { status: 401 });
      }
      await createSession(user.id);
      return NextResponse.json({ user: { id: user.id, displayName: user.display_name, bookieUsername: user.bookie_username } });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Unable to sign in", error);
    return NextResponse.json({ error: "Sign-in is temporarily unavailable. Check the MariaDB connection." }, { status: 503 });
  }
}

function verifyPassword(password: string, stored: string): boolean {
  const [scheme, salt, hash] = stored.split(":");
  if (scheme !== "scrypt" || !salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}