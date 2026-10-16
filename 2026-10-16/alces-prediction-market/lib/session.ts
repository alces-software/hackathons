import crypto from "crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "alces_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not configured");
  return secret;
}

function sign(value: string): string {
  return crypto.createHmac("sha256", sessionSecret()).update(value).digest("base64url");
}

function serialize(userId: number): string {
  const payload = `${userId}.${Date.now()}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

function deserialize(token: string): number | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const payload = Buffer.from(parts[0], "base64url").toString("utf8");
  const expected = sign(payload);
  const given = Buffer.from(parts[1]);
  const actual = Buffer.from(expected);
  if (given.length !== actual.length || !crypto.timingSafeEqual(given, actual)) return null;
  const [rawId, rawIssued] = payload.split(".");
  const userId = Number(rawId);
  const issuedAt = Number(rawIssued);
  if (!Number.isInteger(userId) || userId <= 0 || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > MAX_AGE_SECONDS * 1000) return null;
  return userId;
}

export async function createSession(userId: number): Promise<void> {
  const store = await cookies();
  store.set(COOKIE_NAME, serialize(userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  store.delete(COOKIE_NAME);
}

export async function getSessionUserId(): Promise<number | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return deserialize(token);
}

export async function requireSessionUserId(): Promise<number> {
  const userId = await getSessionUserId();
  if (!userId) {
    const { AccountError } = await import("@/lib/accounts");
    throw new AccountError("Sign in to keep making predictions.", 401);
  }
  return userId;
}