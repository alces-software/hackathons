import { NextResponse } from "next/server";
import type { PoolConnection } from "mariadb";
import { getDbPool } from "@/lib/db";
import { payoutPerShareMb } from "@/lib/pricing";
import { getAlcesUser, getBookieCredentials, AccountError } from "@/lib/accounts";
import { serviceTransaction, BookieError } from "@/lib/bookie";
import { requireSessionUserId } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

// Consensus needs at least three votes with a 66% majority to settle.
const VOTES_TO_RESOLVE = 3;

async function settleMarket(connection: PoolConnection, marketId: string, winningOutcome: string) {
  const totals = await connection.query(
    "SELECT pool_mb, COALESCE(SUM(CASE WHEN outcome = ? THEN shares ELSE 0 END), 0) AS winningShares FROM markets LEFT JOIN positions ON positions.market_id = markets.id WHERE markets.id = ?",
    [winningOutcome, marketId],
  ) as Array<{ pool_mb: number; winningShares: number }>;
  const poolMb = Number(totals[0]?.pool_mb ?? 0);
  const winningShares = Number(totals[0]?.winningShares ?? 0);
  if (poolMb <= 0 || winningShares <= 0) return;

  const perShare = payoutPerShareMb(poolMb, winningShares);
  if (perShare <= 0) return;

  const winners = await connection.query(
    "SELECT user_id, shares FROM positions WHERE market_id = ? AND outcome = ? AND shares > 0",
    [marketId, winningOutcome],
  ) as Array<{ user_id: number; shares: number }>;
  let paidOut = 0;
  for (const winner of winners) {
    const credit = Number((perShare * Number(winner.shares)).toFixed(2));
    if (credit <= 0) continue;
    // Credit the winner's bookie balance first; a bookie failure aborts
    // settlement before any local ledger changes.
    await getAlcesUser(winner.user_id);
    const credentials = await getBookieCredentials(winner.user_id);
    await serviceTransaction(credentials.username, credentials.password, "win", credit);
    await connection.query(
      "UPDATE users SET moose_bucks = moose_bucks + ? WHERE id = ?",
      [credit, winner.user_id],
    );
    paidOut = Number((paidOut + credit).toFixed(2));
  }
  // Losing shares pay nothing; winning shares record what they actually paid.
  await connection.query(
    "UPDATE positions SET payout_mb = 0 WHERE market_id = ? AND LOWER(outcome) <> LOWER(?)",
    [marketId, winningOutcome],
  );
  await connection.query(
    "UPDATE positions SET payout_mb = ROUND(? * shares, 2) WHERE market_id = ? AND LOWER(outcome) = LOWER(?) AND shares > 0",
    [perShare, marketId, winningOutcome],
  );
  // Whatever rounding left in the pool stays with the house moose.
  await connection.query(
    "UPDATE markets SET pool_mb = 0, platform_fees_mb = platform_fees_mb + ? WHERE id = ?",
    [Math.max(0, Number((poolMb - paidOut).toFixed(2))), marketId],
  );
}

export async function POST(request: Request, context: Context) {
  let connection: PoolConnection | undefined;
  try {
    const { id } = await context.params;
    const userId = await requireSessionUserId();
    const body = (await request.json()) as { outcome?: string };
    const outcome = body.outcome?.trim();
    if (!outcome) return NextResponse.json({ error: "Choose the outcome you think actually happened." }, { status: 400 });

    connection = await getDbPool().getConnection();
    await connection.beginTransaction();
    const markets = await connection.query(
      "SELECT outcomes, status, closes_at FROM markets WHERE id = ? FOR UPDATE",
      [id],
    ) as Array<{ outcomes: string | string[]; status: string; closes_at: Date }>;
    const market = markets[0];
    if (!market) {
      await connection.rollback();
      return NextResponse.json({ error: "Market not found." }, { status: 404 });
    }
    const outcomes = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) as string[] : market.outcomes;
    const resolvedOutcome = outcomes.find((option) => option.toLowerCase() === outcome.toLowerCase());
    if (!resolvedOutcome) {
      await connection.rollback();
      return NextResponse.json({ error: "That outcome is not part of this market." }, { status: 400 });
    }
    if (new Date(market.closes_at).getTime() > Date.now()) {
      await connection.rollback();
      return NextResponse.json({ error: "Resolution voting opens after the market closes." }, { status: 409 });
    }
    if (market.status === "resolved") {
      await connection.rollback();
      return NextResponse.json({ error: "This market has already been resolved." }, { status: 409 });
    }

    await connection.query(
      "INSERT INTO resolution_votes (user_id, market_id, outcome) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE outcome = VALUES(outcome), created_at = CURRENT_TIMESTAMP",
      [userId, id, resolvedOutcome],
    );
    const votes = await connection.query(
      "SELECT outcome, COUNT(*) AS votes FROM resolution_votes WHERE market_id = ? GROUP BY outcome ORDER BY votes DESC",
      [id],
    ) as Array<{ outcome: string; votes: number }>;
    const totalVotes = votes.reduce((sum, vote) => sum + Number(vote.votes), 0);
    const leader = votes[0];
    const resolved = totalVotes >= VOTES_TO_RESOLVE && leader && Number(leader.votes) / totalVotes >= 0.66;
    if (resolved) {
      await connection.query("UPDATE markets SET status = 'resolved', resolution_outcome = ? WHERE id = ?", [leader.outcome, id]);
      await settleMarket(connection, id, leader.outcome);
    } else {
      await connection.query("UPDATE markets SET status = 'closed' WHERE id = ? AND status = 'open'", [id]);
    }
    await connection.commit();
    return NextResponse.json({
      message: resolved ? `Resolved as “${leader.outcome}”.` : "Vote recorded. More herd votes are needed.",
      resolved,
      outcome: resolved ? leader.outcome : null,
      votes: votes.map((vote) => ({ outcome: vote.outcome, votes: Number(vote.votes) })),
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BookieError) {
      return NextResponse.json({ error: `Bookie: ${error.message}` }, { status: 502 });
    }
    console.error("Unable to record resolution vote", error);
    return NextResponse.json({ error: "Unable to record the resolution vote. Check the MariaDB connection." }, { status: 503 });
  } finally {
    connection?.release();
  }
}
