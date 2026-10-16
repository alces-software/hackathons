import crypto from "crypto";
import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { createSession } from "@/lib/session";

type RegisterRequest = { displayName?: string; password?: string; passwordConfirm?: string };

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequest;
    const displayName = body.displayName?.trim() ?? "";
    const password = body.password ?? "";
    const passwordConfirm = body.passwordConfirm ?? "";

    if (displayName.length < 2 || displayName.length > 100) {
      return NextResponse.json({ error: "Pick a name between 2 and 100 characters." }, { status: 400 });
    }
    if (password.length < 4 || password.length > 100) {
      return NextResponse.json({ error: "Passwords need at least 4 characters." }, { status: 400 });
    }
    if (password !== passwordConfirm) {
      return NextResponse.json({ error: "The two passwords do not match." }, { status: 400 });
    }

    const connection = await getDbPool().getConnection();
    try {
      const existing = await connection.query(
        "SELECT id FROM users WHERE LOWER(display_name) = LOWER(?)",
        [displayName],
      ) as Array<{ id: number }>;
      if (existing.length) {
        return NextResponse.json({ error: "That name is already taken by another moose." }, { status: 409 });
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const hash = crypto.scryptSync(password, salt, 64).toString("hex");
      const result = await connection.query(
        "INSERT INTO users (display_name, password_hash) VALUES (?, ?)",
        [displayName, `scrypt:${salt}:${hash}`],
      );
      const userId = Number(result.insertId);
      await createSession(userId);
      return NextResponse.json({ user: { id: userId, displayName, bookieUsername: null } }, { status: 201 });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Unable to register", error);
    return NextResponse.json({ error: "Registration is temporarily unavailable. Check the MariaDB connection." }, { status: 503 });
  }
}