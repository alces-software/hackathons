import { NextResponse } from "next/server";
import type { PoolConnection } from "mariadb";
import { getDbPool } from "@/lib/db";
import { requireSessionUserId } from "@/lib/session";
import { AccountError } from "@/lib/accounts";

export async function GET() {
  let connection: PoolConnection | undefined;

  try {
    const userId = await requireSessionUserId();
    const pool = getDbPool();
    connection = await pool.getConnection();

    const rows = await connection.query(
      `SELECT p.market_id, p.outcome, p.shares, p.total_staked, p.payout_mb, p.created_at,
              m.title, m.status, m.resolution_outcome
       FROM positions p
       JOIN markets m ON m.id = p.market_id
       WHERE p.user_id = ?
       ORDER BY p.created_at DESC, p.market_id DESC`,
      [userId],
    ) as Array<{
      market_id: string;
      outcome: string;
      shares: number;
      total_staked: number;
      payout_mb: number | null;
      created_at: Date;
      title: string;
      status: string;
      resolution_outcome: string | null;
    }>;

    return NextResponse.json({
      positions: rows.map((row) => ({
        marketId: row.market_id,
        title: row.title,
        outcome: row.outcome,
        shares: Number(row.shares),
        amount: Number(row.total_staked),
        payout: row.payout_mb === null ? null : Number(row.payout_mb),
        status: row.status,
        result: positionResult(row.status, row.outcome, row.resolution_outcome),
        placedAt: row.created_at instanceof Date ? row.created_at.toISOString() : String(row.created_at),
      })),
    });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Unable to load positions", error);
    return NextResponse.json(
      { error: "Unable to load your predictions right now." },
      { status: 503 },
    );
  } finally {
    connection?.release();
  }
}

function positionResult(status: string, outcome: string, resolutionOutcome: string | null): "win" | "loss" | null {
  if (status !== "resolved" || resolutionOutcome === null) return null;
  return outcome.toLowerCase() === resolutionOutcome.toLowerCase() ? "win" : "loss";
}