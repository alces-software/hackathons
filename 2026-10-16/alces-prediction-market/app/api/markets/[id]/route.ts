import { NextResponse } from "next/server";
import type { PoolConnection } from "mariadb";
import { getDbPool } from "@/lib/db";
import { priceMbForMarket } from "@/lib/pricing";
import { getSessionUserId } from "@/lib/session";

type Context = { params: Promise<{ id: string }> };

export async function GET(_: Request, context: Context) {
  let connection: PoolConnection | undefined;
  try {
    const { id } = await context.params;
    connection = await getDbPool().getConnection();
    const rows = await connection.query(
      `SELECT id, category, title, outcomes, status, closes_at, resolution_outcome,
        total_volume AS volume
       FROM markets WHERE id = ?`,
      [id],
    ) as Array<Record<string, unknown>>;
    const market = rows[0];
    if (!market) return NextResponse.json({ error: "Market not found." }, { status: 404 });

    const positions = await connection.query(
      `SELECT outcome, SUM(total_staked) AS amount, COUNT(*) AS bets
       FROM positions WHERE market_id = ? GROUP BY outcome ORDER BY amount DESC`,
      [id],
    ) as Array<{ outcome: string; amount: number; bets: number }>;
    const totalStaked = positions.reduce((sum, position) => sum + Number(position.amount), 0);
    const normalizedPositions = positions.map((position) => ({
      ...position,
      outcome: position.outcome.toLowerCase(),
    }));
    const outcomes = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) : market.outcomes;
    const viewerId = await getSessionUserId();
    const userPositions = viewerId
      ? await connection.query(
          "SELECT outcome, shares FROM positions WHERE market_id = ? AND user_id = ?",
          [id, viewerId],
        ) as Array<{ outcome: string; shares: number }>
      : [];
    const stats: Array<{ outcome: string; amount: number; bets: number; probability: number; priceMb: number }> = outcomes.map((outcome: string) => {
      const position = normalizedPositions.find((item) => item.outcome === outcome.toLowerCase());
      return {
        outcome,
        amount: position ? Number(position.amount) : 0,
        bets: position ? Number(position.bets) : 0,
        probability: totalStaked && position ? Math.round((Number(position.amount) / totalStaked) * 100) : 0,
        priceMb: totalStaked && position
          ? priceMbForMarket(Number(position.amount), totalStaked, outcomes.length)
          : 0.5,
      };
    });
    await connection.query(
      "INSERT INTO market_price_history (market_id, prices) VALUES (?, ?)",
      [id, JSON.stringify(Object.fromEntries(stats.map((stat) => [stat.outcome, stat.priceMb])))],
    );
    const historyRows = await connection.query(
      "SELECT UNIX_TIMESTAMP(recorded_at) * 1000 AS t, prices FROM market_price_history WHERE market_id = ? ORDER BY recorded_at ASC",
      [id],
    ) as Array<{ t: number; prices: string | Record<string, number> }>;

    return NextResponse.json({
      market: {
        ...market,
        outcomes,
        volume: totalStaked,
        closesAt: market.closes_at,
        resolutionOutcome: market.resolution_outcome,
        history: historyRows.map((point) => ({
          t: Number(point.t),
          prices: outcomes.reduce((prices: Record<string, number>, outcome: string) => {
            const storedPrices = typeof point.prices === "string" ? JSON.parse(point.prices) as Record<string, number> : point.prices;
            const key = Object.keys(storedPrices).find((storedOutcome) => storedOutcome.toLowerCase() === outcome.toLowerCase());
            prices[outcome] = key ? Number(storedPrices[key]) : 0.5;
            return prices;
          }, {}),
        })),
        stats,
        positions: userPositions.map((position) => ({
          outcome: position.outcome,
          shares: Number(position.shares),
        })),
      },
    });
  } catch (error) {
    console.error("Unable to load market", error);
    return NextResponse.json({ error: "Unable to load this market. Check the MariaDB connection." }, { status: 503 });
  } finally {
    connection?.release();
  }
}
