import crypto from "crypto";

const BOOKIE_API_URL = process.env.BOOKIE_API_URL ?? "http://10.151.0.85:3000/api/v1";
const BOOKIE_SERVICE_TOKEN = process.env.BOOKIE_SERVICE_TOKEN ?? "";

export class BookieError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

type BookieUser = {
  id: number;
  username: string;
  balance: number;
  debt: number;
  winnings: number;
  losses: number;
};

type ServiceTransactionType = "win" | "loss" | "hold" | "return";

type ServiceTransactionResult = { id: number };

function friendlyMessage(status: number, body: Record<string, unknown>): string {
  const raw = typeof body.message === "string" ? body.message : "";
  switch (body.error) {
    case "UNAUTHORISED":
      return "Bookie credentials are incorrect";
    case "CONFLICTING_RESOURCE":
      return "A bookie account with that name already exists";
    case "NOT_FOUND":
      return "Bookie account not found";
    case "BAD_REQUEST":
      return raw || "Bookie rejected the request";
    default:
      return raw || `Bookie request failed (${status})`;
  }
}

async function bookieFetch(
  path: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<Response> {
  const { json, ...rest } = init;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (json !== undefined) {
    rest.body = JSON.stringify(json);
  }
  const res = await fetch(`${BOOKIE_API_URL}${path}`, {
    ...rest,
    headers: { ...headers, ...(rest.headers as Record<string, string>) },
    cache: "no-store",
  });
  return res;
}

async function parseBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function hashBookiePassword(password: string): string {
  return crypto.createHash("sha256").update(`alces-bookie:${password}`).digest("hex");
}

export function verifyBookiePassword(password: string, hash: string): boolean {
  const candidate = Buffer.from(hashBookiePassword(password));
  const stored = Buffer.from(hash, "hex");
  return candidate.length === stored.length && crypto.timingSafeEqual(candidate, stored);
}

export async function createBookieUser(
  username: string,
  password: string
): Promise<void> {
  const res = await bookieFetch("/users", {
    method: "POST",
    json: { username, password },
  });
  if (res.status === 409) return; // already provisioned
  if (!res.ok) {
    const body = await parseBody(res);
    throw new BookieError(res.status, friendlyMessage(res.status, body));
  }
}

export async function loginBookieUser(
  username: string,
  password: string
): Promise<void> {
  const res = await bookieFetch("/users/login", {
    method: "POST",
    json: { username, password },
  });
  if (res.status === 204) return;
  const body = await parseBody(res);
  throw new BookieError(res.status, friendlyMessage(res.status, body));
}

export async function getBookieUser(username: string): Promise<BookieUser> {
  const res = await bookieFetch(`/users/${encodeURIComponent(username)}`, {
    method: "GET",
  });
  if (!res.ok) {
    const body = await parseBody(res);
    throw new BookieError(res.status, friendlyMessage(res.status, body));
  }
  return (await res.json()) as BookieUser;
}

export async function serviceTransaction(
  username: string,
  password: string,
  type: ServiceTransactionType,
  amount: number
): Promise<ServiceTransactionResult> {
  const res = await bookieFetch("/services/transaction", {
    method: "POST",
    json: { username, password, serviceToken: BOOKIE_SERVICE_TOKEN, amount, type },
  });
  if (!res.ok) {
    const body = await parseBody(res);
    throw new BookieError(res.status, friendlyMessage(res.status, body));
  }
  return (await res.json()) as ServiceTransactionResult;
}

export async function bookieBalance(username: string): Promise<number> {
  const user = await getBookieUser(username);
  return user.balance;
}