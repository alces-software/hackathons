import { NextResponse } from "next/server";
import { getDbPool } from "@/lib/db";
import { getSessionUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    void request.url;
    const userId = await getSessionUserId();
    if (!userId) return NextResponse.json({ user: null });

    const connection = await getDbPool().getConnection();
    try {
      const rows = await connection.query(
        "SELECT id, display_name, bookie_username FROM users WHERE id = ?",
        [userId],
      ) as Array<{ id: number; display_name: string; bookie_username: string | null }>;
      const user = rows[0];
      if (!user) return NextResponse.json({ user: null });
      return NextResponse.json({
        user: { id: user.id, displayName: user.display_name, bookieUsername: user.bookie_username },
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error("Unable to load session", error);
    return NextResponse.json({ error: "Unable to load your session. Check the MariaDB connection." }, { status: 503 });
  }
}