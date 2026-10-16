import { NextResponse } from "next/server";
import type { PoolConnection } from "mariadb";
import { getDbPool } from "@/lib/db";
import { priceMbForMarket, poolContributionMb, platformFeeMb } from "@/lib/pricing";
import { getAlcesUser, getBookieCredentials, AccountError } from "@/lib/accounts";
import { serviceTransaction, BookieError } from "@/lib/bookie";
import { requireSessionUserId } from "@/lib/session";

type PredictionRequest = {
  marketId?: string;
  outcome?: string;
  amount?: number;
};

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;

  try {
    const body = (await request.json()) as PredictionRequest;
    const marketId = body.marketId?.trim();
    const outcome = body.outcome;
    const amount = body.amount;

    if (
      !marketId ||
      !outcome ||
      typeof amount !== "number" ||
      !Number.isFinite(amount) ||
      amount <= 0
    ) {
      return NextResponse.json(
        { error: "Choose an outcome and enter a stake greater than zero." },
        { status: 400 },
      );
    }

    const pool = getDbPool();
    const userId = await requireSessionUserId();
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const markets = await connection.query(
      "SELECT id, closes_at, outcomes FROM markets WHERE id = ? AND status = 'open' FOR UPDATE",
      [marketId],
    );
    const market = markets[0] as { id: string; closes_at: Date; outcomes: string | string[] } | undefined;

    if (!market) {
      throw new RequestError("This market is not open for predictions.", 404);
    }
    if (new Date(market.closes_at).getTime() <= Date.now()) {
      throw new RequestError("This market has closed.", 409);
    }
    const outcomes = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) as string[] : market.outcomes;
    const selectedOutcome = outcomes.find((option) => option.toLowerCase() === outcome.toLowerCase());
    if (!selectedOutcome) {
      throw new RequestError("That outcome is not available for this market.", 400);
    }
    const stakeRows = await connection.query(
      "SELECT outcome, SUM(total_staked) AS amount FROM positions WHERE market_id = ? GROUP BY outcome",
      [marketId],
    ) as Array<{ outcome: string; amount: number }>;
    const totalStaked = stakeRows.reduce((sum, row) => sum + Number(row.amount), 0);
    const currentStake = stakeRows.find((row) => row.outcome.toLowerCase() === selectedOutcome.toLowerCase());
    const priceMb = priceMbForMarket(Number(currentStake?.amount ?? 0), totalStaked, outcomes.length);
    const shares = Math.floor(amount / priceMb);
    if (shares < 1) {
      throw new RequestError(`Enter at least ${priceMb.toFixed(2)} MB to buy one share.`, 400);
    }
    const cost = Number((shares * priceMb).toFixed(2));
    const fee = platformFeeMb(cost);
    const pooled = poolContributionMb(cost);

    const users = await connection.query(
      "SELECT id, moose_bucks FROM users WHERE id = ? FOR UPDATE",
      [userId],
    );
    const user = users[0] as { id: number; moose_bucks: number } | undefined;

    if (!user) {
      throw new RequestError("Your account could not be found.", 404);
    }
    if (Number(user.moose_bucks) < cost) {
      throw new RequestError("You do not have enough moose bucks for that prediction.", 400);
    }

    // Bookie first: the user's stake leaves their bookie balance before the
    // local ledger changes, so a bookie failure aborts the whole trade.
    await getAlcesUser(user.id);
    const credentials = await getBookieCredentials(user.id);
    const bookieTx = await serviceTransaction(
      credentials.username,
      credentials.password,
      "loss",
      cost,
    );

    await connection.query(
      "UPDATE users SET moose_bucks = moose_bucks - ? WHERE id = ?",
      [cost, userId],
    );
    await connection.query(
      `INSERT INTO positions (user_id, market_id, outcome, shares, total_staked, bookie_transaction_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         shares = shares + VALUES(shares),
         total_staked = total_staked + VALUES(total_staked)`,
      [userId, marketId, selectedOutcome, shares, cost, bookieTx.id],
    );
    await connection.query(
      "UPDATE markets SET total_volume = total_volume + ?, pool_mb = pool_mb + ?, platform_fees_mb = platform_fees_mb + ? WHERE id = ?",
      [cost, pooled, fee, marketId],
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

    const updatedUsers = await connection.query(
      "SELECT moose_bucks FROM users WHERE id = ?",
      [userId],
    );

    return NextResponse.json({
      message: `Prediction placed: ${selectedOutcome} for ${cost.toFixed(2)} moose bucks (${shares} whole shares at ${priceMb.toFixed(2)} MB; the moose keeps ${fee.toFixed(2)} MB).`,
      mooseBucks: Number(updatedUsers[0].moose_bucks),
      shares,
      priceMb,
      cost,
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }

    if (error instanceof RequestError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BookieError) {
      return NextResponse.json({ error: `Bookie: ${error.message}` }, { status: 502 });
    }

    console.error("Unable to place prediction", error);
    return NextResponse.json(
      {
        error: error instanceof Error && error.message === "DATABASE_URL is not configured"
          ? "MariaDB is not configured. Copy .env.example to .env.local, then start MariaDB with docker compose up -d."
          : "Predictions are temporarily unavailable. Start MariaDB with docker compose up -d and try again.",
      },
      { status: 503 },
    );
  } finally {
    connection?.release();
  }
}

class RequestError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}
