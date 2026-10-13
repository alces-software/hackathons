import { NextResponse } from "next/server";
import { api, ApiError } from "@/lib/api";
import { getSession } from "@/lib/session";

// Password changes pass through here rather than to the core directly: the
// account name comes from the session cookie, and both passwords are given
// fresh per change and never stored. (The core takes this as PATCH /users.)

type Body = {
  password?: unknown;
  newPassword?: unknown;
};

function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const isPassword = (v: unknown): v is string =>
  typeof v === "string" && v.length >= 4 && v.length <= 30;

export async function POST(req: Request) {
  const me = await getSession();
  if (!me) {
    return bad("Sign in before changing the password.", 401);
  }

  const body: Body = await req.json().catch(() => ({}));
  const { password, newPassword } = body;

  if (!isPassword(password) || !isPassword(newPassword)) {
    return bad("Passwords are between 4 and 30 characters.");
  }
  if (password === newPassword) {
    return bad("The new password can’t be the old one.");
  }

  try {
    await api("/users", {
      method: "PATCH",
      body: { username: me, password, newPassword },
    });
  } catch (e) {
    if (!(e instanceof ApiError)) throw e;
    if (e.status === 0) {
      return bad(e.message, 502);
    }
    if (e.status === 401) {
      return bad("That current password doesn’t match the account.", 401);
    }
    if (e.status === 404) {
      return bad("No account under that name.", 404);
    }
    return bad("The core refused the change.", 502);
  }

  return new Response(null, { status: 204 });
}