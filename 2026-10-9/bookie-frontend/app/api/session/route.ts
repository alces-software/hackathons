import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { api, ApiError, userExists } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/session";

// The core has no session endpoint, so this route turns the one credential
// the browser sends into a signed-in shape we control: an httpOnly cookie
// carrying the account name.

type Body = {
  mode?: unknown;
  username?: unknown;
  password?: unknown;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const YEAR = 60 * 60 * 24 * 365;

export async function POST(req: Request) {
  const body: Body = await req.json().catch(() => ({}));
  const { mode, username, password } = body;

  if (typeof username !== "string" || username.length < 4 || username.length > 25) {
    return bad("Names are between 4 and 25 characters.");
  }
  if (
    typeof password !== "string" ||
    password.length < 4 ||
    password.length > 30
  ) {
    return bad("Passwords are between 4 and 30 characters.");
  }

  try {
    if (mode === "signup") {
      await api("/users", { method: "POST", body: { username, password } });
    } else if (mode === "login") {
      if (!(await userExists(username))) {
        return bad("No account under that name.", 401);
      }
    } else {
      return bad("Unrecognised request.");
    }
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 409) {
      return bad("That name is already on the book.", 409);
    }
    if (e.status === 0) {
      return bad(e.message, 502);
    }
    return bad("The core refused the request.", 502);
  }

  const jar = await cookies();
  jar.set(SESSION_COOKIE, username, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: YEAR,
  });

  return NextResponse.json({ username });
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}