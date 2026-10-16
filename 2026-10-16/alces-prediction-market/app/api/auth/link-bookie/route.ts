import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { requireSessionUserId } from "@/lib/session";
import { encryptBookiePassword } from "@/lib/accounts";
import { loginBookieUser, getBookieUser, BookieError } from "@/lib/bookie";

type LinkRequest = { bookieUsername?: string; bookiePassword?: string };

export async function POST(request: Request) {
  try {
    const userId = await requireSessionUserId();
    const body = (await request.json()) as LinkRequest;
    const bookieUsername = body.bookieUsername?.trim() ?? "";
    const bookiePassword = body.bookiePassword ?? "";

    if (!bookieUsername || !bookiePassword) {
      return NextResponse.json({ error: "Enter your bookie username and password." }, { status: 400 });
    }

    // Verify the credentials against the live bookie before storing anything.
    await loginBookieUser(bookieUsername, bookiePassword);
    const bookie = await getBookieUser(bookieUsername);

    const connection = await getDbPool().getConnection();
    try {
      const taken = await connection.query(
        "SELECT id FROM users WHERE bookie_username = ? AND id <> ?",
        [bookieUsername, userId],
      ) as Array<{ id: number }>;
      if (taken.length) {
        return NextResponse.json({ error: "That bookie account is already linked to another Alces account." }, { status: 409 });
      }

      const stored = encryptBookiePassword(bookiePassword);

      await connection.query(
        "UPDATE users SET bookie_username = ?, bookie_password_hash = ? WHERE id = ?",
        [bookieUsername, stored, userId],
      );
      await connection.query(
        "UPDATE users SET moose_bucks = ? WHERE id = ?",
        [bookie.balance, userId],
      );
      return NextResponse.json({
        bookieUsername,
        balance: bookie.balance,
        winnings: bookie.winnings,
        losses: bookie.losses,
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    if (error instanceof BookieError) {
      return NextResponse.json({ error: `Bookie: ${error.message}` }, { status: error.status === 401 ? 401 : 502 });
    }
    console.error("Unable to link bookie account", error);
    return NextResponse.json({ error: "Unable to link your bookie account right now." }, { status: 503 });
  }
}