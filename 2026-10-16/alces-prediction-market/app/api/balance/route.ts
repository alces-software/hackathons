import { NextResponse } from "next/server";
import { getAlcesUser, AccountError } from "@/lib/accounts";
import { getBookieUser, BookieError } from "@/lib/bookie";
import { requireSessionUserId } from "@/lib/session";

export async function GET(request: Request) {
  try {
    void request.url;
    const userId = await requireSessionUserId();
    const user = await getAlcesUser(userId);
    if (!user.bookieUsername) {
      return NextResponse.json({ error: "No bookie account linked." }, { status: 409 });
    }
    const bookie = await getBookieUser(user.bookieUsername);
    return NextResponse.json({
      balance: bookie.balance,
      winnings: bookie.winnings,
      losses: bookie.losses,
      bookieUsername: user.bookieUsername,
    });
  } catch (error) {
    if (error instanceof AccountError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BookieError) {
      return NextResponse.json({ error: `Bookie: ${error.message}` }, { status: 502 });
    }
    console.error("Unable to load balance", error);
    return NextResponse.json({ error: "Unable to load your balance. Check the MariaDB connection." }, { status: 503 });
  }
}