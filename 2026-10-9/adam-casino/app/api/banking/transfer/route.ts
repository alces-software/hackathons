import { NextResponse } from "next/server";

type TransferRequest = {
  username?: string;
  password?: string;
  amount?: number;
  maximumPayout?: number;
  game?: "roulette" | "crash" | "minesweeper" | "plinko" | "uno" | "blackjack";
  direction?: "stake" | "payout" | "loss" | "hold" | "return";
};

const bankingApiUrl = process.env.BANKING_API_URL ?? "http://10.151.0.85:3000/api/v1";

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  let body: TransferRequest;
  try {
    body = await request.json() as TransferRequest;
  } catch {
    return errorResponse("The transfer request must be valid JSON.", 400);
  }

  const { direction } = body;
  const username = typeof body.username === "string" ? body.username.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const amount = typeof body.amount === "number" ? body.amount : NaN;
  const maximumPayout = typeof body.maximumPayout === "number" ? body.maximumPayout : amount;
  const game = body.game;
  if (!username || !password || !Number.isFinite(amount) || amount <= 0 || !Number.isFinite(maximumPayout) || maximumPayout < amount || !direction) {
    return errorResponse("Username, password, a positive amount, and direction are required.", 400);
  }

  const serviceToken = process.env.BANKING_SERVICE_TOKEN;
  const casinoUsername = process.env.CASINO_USERNAME;
  if (!serviceToken || !casinoUsername) {
    return errorResponse("Banking service credentials are not configured.", 503);
  }

  const credentials = { username, password };

  try {
    if (direction === "stake" || direction === "hold") {
      if (!game) return errorResponse("The game must be identified before placing a bet.", 400);
      const payoutMultipliers = { roulette: 36, crash: 20, minesweeper: 20, plinko: 10, uno: 1.95, blackjack: 2.5 };
      const maximumGamePayout = amount * payoutMultipliers[game];
      const balanceResponse = await fetch(`${bankingApiUrl}/services/${encodeURIComponent(casinoUsername)}`, {
        cache: "no-store",
        headers: { Accept: "application/json", Authorization: `Bearer ${serviceToken}` },
      });
      if (!balanceResponse.ok) return errorResponse("The casino balance could not be verified, so this bet cannot be accepted.", 503);
      const balanceBody = await balanceResponse.json() as { balance?: number | string };
      const casinoBalance = typeof balanceBody.balance === "number" ? balanceBody.balance : Number(balanceBody.balance);
      if (!Number.isFinite(casinoBalance) || casinoBalance + amount < maximumGamePayout) {
        return errorResponse("The casino cannot currently cover the maximum payout for this bet.", 409);
      }
    }
    const transactionTypes = { stake: "hold", payout: "win", loss: "loss", hold: "hold", return: "return" } as const;
    const response = await fetch(`${bankingApiUrl}/services/transaction`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ ...credentials, serviceToken, amount, type: transactionTypes[direction] }),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      if (response.status === 401) {
        return errorResponse("The connected banking account credentials were rejected. Disconnect and reconnect with the correct password.", 401);
      }
      return errorResponse(details || `Banking transfer failed with status ${response.status}.`, response.status >= 500 ? 502 : response.status);
    }
    return new Response(null, { status: 204 });
  } catch {
    return errorResponse("The banking service could not be reached.", 502);
  }
}
