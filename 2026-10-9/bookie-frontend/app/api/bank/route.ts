import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/session";

// Bank actions pass through here rather than to the core directly: the
// account name comes from the session cookie, and the password is given
// fresh per action and never stored.

type Body = {
  action?: unknown;
  amount?: unknown;
  password?: unknown;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const me = await getSession();
  if (!me) {
    return bad("Sign in before dealing with the bank.", 401);
  }

  const body: Body = await req.json().catch(() => ({}));
  const { action, amount, password } = body;

  if (action !== "loan" && action !== "repay") {
    return bad("Unrecognised request.");
  }
  const value = typeof amount === "string" ? Number(amount) : amount;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
    return bad("Amounts start at 1.00.");
  }
  if (
    typeof password !== "string" ||
    password.length < 4 ||
    password.length > 30
  ) {
    return bad("Passwords are between 4 and 30 characters.");
  }

  try {
    await api(`/bank/${action}`, {
      method: "POST",
      body: { username: me, password, amount: Math.round(value * 100) / 100 },
    });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 0) {
      return bad(e.message, 502);
    }
    if (e.status === 401) {
      return bad("That password doesn’t match the account.", 401);
    }
    if (e.status === 404) {
      // Same distinction as in the transfer route: a shaped NOT_FOUND is the
      // core talking about you; anything else is a missing endpoint.
      if (e.code === "NOT_FOUND") {
        return bad("No account under that name.", 404);
      }
      return bad(
        "The core has no endpoint at bank — it may need updating.",
        502,
      );
    }
    return bad("The core refused the request.", 502);
  }

  return new Response(null, { status: 204 });
}