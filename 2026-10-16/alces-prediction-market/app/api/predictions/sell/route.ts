import { NextResponse } from "next/server";
import type { PoolConnection } from "mariadb";
import { getDbPool } from "@/lib/db";
import { priceMbForMarket } from "@/lib/pricing";
import { getAlcesUser, getBookieCredentials, AccountError } from "@/lib/accounts";
import { serviceTransaction, BookieError } from "@/lib/bookie";
import { requireSessionUserId } from "@/lib/session";

type SellRequest = { marketId?: string; outcome?: string; shares?: number };

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;
  try {
    const body = (await request.json()) as SellRequest;
    const marketId = body.marketId?.trim();
    const outcome = body.outcome?.trim();
    const shares = body.shares;
    if (!marketId || !outcome || typeof shares !== "number" || !Number.isInteger(shares) || shares < 1) {
      return NextResponse.json({ error: "Choose an outcome and enter a whole number of shares to sell." }, { status: 400 });
    }

    connection = await getDbPool().getConnection();
    const userId = await requireSessionUserId();
    await connection.beginTransaction();
    const markets = await connection.query(
      "SELECT id, closes_at, outcomes FROM markets WHERE id = ? AND status = 'open' FOR UPDATE",
      [marketId],
    ) as Array<{ id: string; closes_at: Date; outcomes: string | string[] }>;
    const market = markets[0];
    if (!market) throw new RequestError("This market is not open for selling.", 404);
    if (new Date(market.closes_at).getTime() <= Date.now()) throw new RequestError("This market has closed.", 409);

    const outcomes = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) as string[] : market.outcomes;
    const selectedOutcome = outcomes.find((option) => option.toLowerCase() === outcome.toLowerCase());
    if (!selectedOutcome) throw new RequestError("That outcome is not available for this market.", 400);

    const positions = await connection.query(
      "SELECT id, shares, total_staked FROM positions WHERE user_id = ? AND market_id = ? AND outcome = ? FOR UPDATE",
      [userId, marketId, selectedOutcome],
    ) as Array<{ id: number; shares: number; total_staked: number }>;
    const position = positions[0];
    if (!position || Number(position.shares) < shares) throw new RequestError("You do not own enough shares to sell.", 400);

    const stakes = await connection.query(
      "SELECT outcome, SUM(total_staked) AS amount FROM positions WHERE market_id = ? GROUP BY outcome",
      [marketId],
    ) as Array<{ outcome: string; amount: number }>;
    const totalStaked = stakes.reduce((sum, row) => sum + Number(row.amount), 0);
    const currentStake = stakes.find((row) => row.outcome.toLowerCase() === selectedOutcome.toLowerCase());
    const priceMb = priceMbForMarket(Number(currentStake?.amount ?? 0), totalStaked, outcomes.length);
    const proceeds = Number((shares * priceMb).toFixed(2));

    const marketRows = await connection.query(
      "SELECT pool_mb FROM markets WHERE id = ? FOR UPDATE",
      [marketId],
    ) as Array<{ pool_mb: number }>;
    const poolMb = Number(marketRows[0]?.pool_mb ?? 0);
    if (poolMb < proceeds) {
      throw new RequestError("Not enough pooled funds to buy back those shares right now.", 400);
    }
    const remainingShares = Number(position.shares) - shares;
    const remainingStake = remainingShares === 0
      ? 0
      : Number((Number(position.total_staked) * remainingShares / Number(position.shares)).toFixed(2));

    // Bookie first: proceeds are credited to the user's bookie balance before
    // the local ledger changes, so a bookie failure aborts the whole sale.
    await getAlcesUser(userId);
    const credentials = await getBookieCredentials(userId);
    const bookieTx = await serviceTransaction(
      credentials.username,
      credentials.password,
      "win",
      proceeds,
    );

    await connection.query(
      "UPDATE users SET moose_bucks = moose_bucks + ? WHERE id = ?",
      [proceeds, userId],
    );
    await connection.query(
      "UPDATE markets SET pool_mb = pool_mb - ? WHERE id = ?",
      [proceeds, marketId],
    );
    if (remainingShares === 0) {
      await connection.query("DELETE FROM positions WHERE id = ?", [position.id]);
    } else {
      await connection.query(
        "UPDATE positions SET shares = ?, total_staked = ?, bookie_transaction_id = ? WHERE id = ?",
        [remainingShares, remainingStake, bookieTx.id, position.id],
      );
    }
    await connection.query(
      "UPDATE markets SET total_volume = GREATEST(0, total_volume - ?) WHERE id = ?",
      [proceeds, marketId],
    );

    const updatedStakes = await connection.query(
      "SELECT outcome, SUM(total_staked) AS amount FROM positions WHERE market_id = ? GROUP BY outcome",
      [marketId],
    ) as Array<{ outcome: string; amount: number }>;
    const updatedTotal = updatedStakes.reduce((sum, row) => sum + Number(row.amount), 0);
    const prices = Object.fromEntries(outcomes.map((option) => {
      const stake = updatedStakes.find((row) => row.outcome.toLowerCase() === option.toLowerCase());
      return [option, priceMbForMarket(Number(stake?.amount ?? 0), updatedTotal, outcomes.length)];
    }));
    await connection.query(
      "INSERT INTO market_price_history (market_id, prices) VALUES (?, ?)",
      [marketId, JSON.stringify(prices)],
    );
    await connection.commit();

    return NextResponse.json({
      message: `Sold ${shares} ${selectedOutcome} shares for ${proceeds.toFixed(2)} moose bucks.`,
      shares,
      priceMb,
      proceeds,
    });
  } catch (error) {
    if (connection) await connection.rollback();
    if (error instanceof RequestError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof AccountError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (error instanceof BookieError) return NextResponse.json({ error: `Bookie: ${error.message}` }, { status: 502 });
    console.error("Unable to sell prediction", error);
    return NextResponse.json({ error: "Selling is temporarily unavailable. Check the MariaDB connection." }, { status: 503 });
  } finally {
    connection?.release();
  }
}

class RequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}
