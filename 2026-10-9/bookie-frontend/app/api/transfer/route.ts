import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/session";

// Transfers pass through here rather than to the core directly: the sender
// comes from the session cookie, the recipient named in the path (the way
// /users/transaction/{username} takes its username), and the password is
// given fresh per transfer and never stored. The browser never calls the
// core itself — it has no CORS and no business holding credentials.

type Body = {
  recipient?: unknown;
  amount?: unknown;
  password?: unknown;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: Request) {
  const me = await getSession();
  if (!me) {
    return bad("Sign in before moving money around.", 401);
  }

  const body: Body = await req.json().catch(() => ({}));
  const { recipient, amount, password } = body;

  if (
    typeof recipient !== "string" ||
    recipient.length < 4 ||
    recipient.length > 25
  ) {
    return bad("Names are between 4 and 25 characters.");
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
    await api(`/users/transaction/${recipient}`, {
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
      // A well-formed NOT_FOUND means the recipient isn't on the book; a
      // 404 with no error shape means the core has nothing at that path.
      if (e.code === "NOT_FOUND") {
        return bad("No account under that name.", 404);
      }
      return bad(
        "The core has no endpoint at users/transaction — it may need updating.",
        502,
      );
    }
    return bad("The core refused the request.", 502);
  }

  return new Response(null, { status: 204 });
}