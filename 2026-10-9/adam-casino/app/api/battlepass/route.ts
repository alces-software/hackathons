import { NextResponse } from "next/server";
import {
  awardBattlePassXp,
  buyPremiumBattlePass,
  claimBattlePassReward,
  revertBattlePassClaim,
  viewBattlePass,
} from "@/lib/battlepass";

const bankingApiUrl = process.env.BANKING_API_URL ?? "http://10.151.0.85:3000/api/v1";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Pass progress and full ladder for one player (public read, keyed by banking username). */
export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username")?.trim();
  if (!username) return errorResponse("Username is required.");
  return NextResponse.json(viewBattlePass(username));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      action?: "claim" | "buy-premium" | "award-xp";
      username?: string;
      password?: string;
      level?: number;
      track?: "free" | "premium";
      amount?: number;
    };
    const username = body.username?.trim();
    if (!username) throw new Error("Sign in with your banking account to use the Alces Pass.");
    if (body.action === "claim") {
      const track = body.track === "premium" ? "premium" : "free";
      const level = Number(body.level) || 0;
      const rewards = claimBattlePassReward(username, level, track);
      // Moose-buck rewards are credited through the banking service; cosmetics were already granted.
      const payout = rewards.find((reward) => reward.kind === "moose-bucks");
      if (payout && payout.kind === "moose-bucks") {
        if (!body.password) throw new Error("Confirm your banking password for this reward.");
        const credit = await fetch(`${bankingApiUrl}/services/transaction`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password: body.password, serviceToken: process.env.BANKING_SERVICE_TOKEN, amount: payout.amount, type: "win" }),
        });
        if (credit.status === 401) throw new Error("Banking credentials were rejected — connect your banking account again.");
        if (!credit.ok && credit.status !== 204) {
          revertBattlePassClaim(username, level, track);
          throw new Error("The banking service could not pay your reward — try again shortly.");
        }
      }
      return NextResponse.json({ view: viewBattlePass(username), rewards });
    }
    if (body.action === "buy-premium") {
      if (!body.password) throw new Error("Confirm your banking password to buy the premium pass.");
      return NextResponse.json({ view: await buyPremiumBattlePass(username, { username, password: body.password }) });
    }
    if (body.action === "award-xp") {
      // Ops/test hook; production XP flows through the banking transfer route.
      awardBattlePassXp(username, Number(body.amount) || 0);
      return NextResponse.json({ view: viewBattlePass(username) });
    }
    throw new Error("Unknown Alces Pass action.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected Alces Pass error.";
    const unauthorized = /banking credentials/i.test(message);
    return errorResponse(message, unauthorized ? 401 : 400);
  }
}
