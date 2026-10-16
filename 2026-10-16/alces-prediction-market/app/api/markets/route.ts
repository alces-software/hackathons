import { NextResponse } from "next/server";
import type { PoolConnection } from "mariadb";
import { getDbPool } from "@/lib/db";
import { PRICE_FLOOR_MB, priceMbForMarket } from "@/lib/pricing";

export async function GET() {
  let connection: PoolConnection | undefined;
  try {
    connection = await getDbPool().getConnection();
    const rows = await connection.query(
      "SELECT id, category, title, outcomes, total_volume AS volume FROM markets WHERE category = 'consensus' AND status IN ('open', 'closed') ORDER BY created_at DESC",
    ) as Array<{ id: string; category: string; title: string; outcomes: string | string[]; volume: number }>;
    const ids = rows.map((market) => market.id);
    const stakes = ids.length
      ? await connection.query(
        "SELECT market_id, outcome, SUM(total_staked) AS amount FROM positions WHERE market_id IN (?) GROUP BY market_id, outcome",
        [ids],
      ) as Array<{ market_id: string; outcome: string; amount: number }>
      : [];
    const markets = rows.map((market) => {
      const outcomes = typeof market.outcomes === "string" ? JSON.parse(market.outcomes) as string[] : market.outcomes;
      const marketStakes = stakes.filter((stake) => stake.market_id === market.id);
      const totalStaked = marketStakes.reduce((sum, stake) => sum + Number(stake.amount), 0);
      const stakeFor = (outcome: string) =>
        Number(marketStakes.find((stake) => stake.outcome.toLowerCase() === outcome.toLowerCase())?.amount ?? 0);
      // Same pricing the market page uses, so cards and detail never disagree.
      const outcomePrices = outcomes.map((outcome) =>
        totalStaked > 0 ? priceMbForMarket(stakeFor(outcome), totalStaked, outcomes.length) : PRICE_FLOOR_MB,
      );
      const volume = Number(market.volume);
      return {
        id: market.id,
        category: market.category[0].toUpperCase() + market.category.slice(1),
        title: market.title,
        outcomes,
        outcomePrices,
        volume: volume >= 1000 ? `${(volume / 1000).toFixed(1)}k` : `${Math.round(volume)}`,
        accent: market.category === "consensus" ? "pine" : market.category === "entertainment" ? "berry" : market.category === "tech" ? "sky" : "pine",
      };
    });
    return NextResponse.json({ markets });
  } catch (error) {
    console.error("Unable to load markets", error);
    return NextResponse.json({ error: databaseErrorMessage(error, "load markets") }, { status: 503 });
  } finally {
    connection?.release();
  }
}

export async function POST(request: Request) {
  let connection: PoolConnection | undefined;
  try {
    const body = (await request.json()) as { title?: string; category?: string; closesAt?: string; outcomes?: string[] };
    const title = body.title?.trim();
    const category = body.category?.toLowerCase();
    const closesAt = body.closesAt ? new Date(body.closesAt) : null;
    const outcomes = [...new Set((body.outcomes ?? []).map((outcome) => outcome.trim()).filter(Boolean))];
    if (!title || title.length < 10 || category !== "consensus" || outcomes.length < 2 || outcomes.length > 8 || outcomes.some((outcome) => outcome.length > 80) || !closesAt || Number.isNaN(closesAt.getTime()) || closesAt <= new Date()) {
      return NextResponse.json({ error: "Enter a question, between 2 and 8 distinct outcomes, and a future closing time." }, { status: 400 });
    }
    const id = `${category}-${crypto.randomUUID()}`;
    const pool = getDbPool();
    connection = await pool.getConnection();
    await connection.query("INSERT INTO markets (id, category, title, outcomes, yes_probability, closes_at) VALUES (?, ?, ?, ?, 50, ?)", [id, category, title, JSON.stringify(outcomes), closesAt]);
    return NextResponse.json({ market: { id, title, category: category[0].toUpperCase() + category.slice(1), outcomes } }, { status: 201 });
  } catch (error) {
    console.error("Unable to create market", error);
    return NextResponse.json({ error: databaseErrorMessage(error, "create markets") }, { status: 503 });
  } finally {
    connection?.release();
  }
}

function databaseErrorMessage(error: unknown, action: string) {
  if (error instanceof Error && error.message === "DATABASE_URL is not configured") {
    return "MariaDB is not configured. Copy .env.example to .env.local, then start MariaDB with docker compose up -d.";
  }

  return `Unable to ${action}. Start MariaDB with docker compose up -d and try again.`;
}
