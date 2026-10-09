import { NextResponse } from "next/server";

type TransferRequest = {
  username?: string;
  password?: string;
  amount?: number;
  direction?: "stake" | "payout";
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
  if (!username || !password || !Number.isFinite(amount) || amount <= 0 || !direction) {
    return errorResponse("Username, password, a positive amount, and direction are required.", 400);
  }

  const serviceToken = process.env.BANKING_SERVICE_TOKEN;
  const casinoUsername = process.env.CASINO_USERNAME;
  const casinoPassword = process.env.CASINO_PASSWORD;
  if (!serviceToken || !casinoUsername || !casinoPassword) {
    return errorResponse("Banking service credentials are not configured.", 503);
  }

  const transferUsername = direction === "stake" ? casinoUsername : username;
  const credentials = direction === "stake"
    ? { username, password }
    : { username: casinoUsername, password: casinoPassword };

  try {
    const response = await fetch(`${bankingApiUrl}/transactions/service/${encodeURIComponent(transferUsername)}`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ ...credentials, serviceToken, amount }),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text();
      return errorResponse(details || `Banking transfer failed with status ${response.status}.`, response.status >= 500 ? 502 : response.status);
    }
    return new Response(null, { status: 204 });
  } catch {
    return errorResponse("The banking service could not be reached.", 502);
  }
}
