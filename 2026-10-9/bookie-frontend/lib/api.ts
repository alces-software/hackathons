// Server-only access to the logical core. The base URL never reaches the
// browser: pages render on the server and mutations go through /api/session.

const API_URL = process.env.API_URL ?? "http://localhost:8000/api/v1";

export type Txn = {
  id?: number;
  /** Null for entries that don't involve a user account. */
  sender: string | null;
  receiver: string | null;
  createdAt: string;
  amount: number;
  service: { id: number | null; name: string | null };
};

export type User = {
  id?: number;
  username: string;
  balance: number;
  debt: number;
  winnings: number;
  losses: number;
};

export type Page<T> = {
  data: T[];
  currentPage: number;
  totalPages: number;
  limit: number;
  itemCount: number;
  itemTotal: number;
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request<T>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      cache: "no-store",
      method: init?.method,
      headers: init?.body ? { "content-type": "application/json" } : undefined,
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "UNREACHABLE", "The ledger core is unreachable.");
  }
  if (res.status === 204) return undefined as T;

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(
      res.status,
      json.error ?? "UNKNOWN",
      json.message ?? "The core gave an unexpected response.",
    );
  }
  return json as T;
}

export async function api<T = unknown>(
  path: string,
  init?: { method?: string; body?: unknown },
): Promise<T> {
  return request<T>(path, init);
}

export async function getPage<T>(
  path: string,
  page: number,
  limit: number,
  extra?: Record<string, string>,
): Promise<Page<T>> {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    ...extra,
  });
  return request<Page<T>>(`${path}?${params}`);
}

/** Collect a full collection, capped so a runaway core can't hang us. */
export async function fetchAll<T>(
  path: string,
  capPages = 50,
  limit = 100,
): Promise<T[]> {
  const out: T[] = [];
  let page = 1;
  let totalPages = Infinity;
  while (page <= Math.min(totalPages, capPages)) {
    const res = await getPage<T>(path, page, limit);
    out.push(...res.data);
    totalPages = res.totalPages;
    if (res.data.length === 0) break;
    page++;
  }
  return out;
}

export type Order = "asc" | "desc";

/** The core reads newest-first (order=desc) unless told otherwise. */
export const getTransactions = (
  page: number,
  limit: number,
  order: Order = "asc",
) => getPage<Txn>("/transactions", page, limit, { order });

/** Balances are fixed-point decimals on the core, so they arrive as strings
 *  ("990"); coerce them so every consumer sees numbers. Missing facts count
 *  as zero, for older cores that don't track them. */
const toUser = (raw: {
  username: string;
  balance: string | number;
  debt?: string | number;
  winnings?: string | number;
  losses?: string | number;
}): User => ({
  username: raw.username,
  balance: Number(raw.balance),
  debt: raw.debt === undefined ? 0 : Number(raw.debt),
  winnings: raw.winnings === undefined ? 0 : Number(raw.winnings),
  losses: raw.losses === undefined ? 0 : Number(raw.losses),
});

export async function getUsers(
  page: number,
  limit: number,
  orderByBalance?: "asc" | "desc",
): Promise<Page<User>> {
  const res = await getPage<{
    username: string;
    balance: string | number;
    debt?: string | number;
    winnings?: string | number;
    losses?: string | number;
  }>(
    "/users",
    page,
    limit,
    orderByBalance ? { orderByBalance } : undefined,
  );
  return { ...res, data: res.data.map(toUser) };
}

/** Walk the whole user list — needed only when every account is wanted at
 *  once (the transfer dropdown). */
export async function getAllUsers(): Promise<User[]> {
  return (
    await fetchAll<{
      username: string;
      balance: string | number;
      debt?: string | number;
      winnings?: string | number;
      losses?: string | number;
    }>("/users")
  ).map(toUser);
}

/** A single account's facts straight off the core — no walking the list. */
export async function getUser(username: string): Promise<User> {
  const raw = await request<{
    username: string;
    balance: string | number;
    debt?: string | number;
    winnings?: string | number;
    losses?: string | number;
  }>(`/users/${username}`);
  return toUser(raw);
}

export type Fees = {
  /** Both are percentages of the amount in play — 5 means 5%. */
  userTransactionFee: number;
  serviceTransactionFee: number;
};

/** What the house skims, per kind of entry. Numbers are coerced; a core
 *  that answers with something odd leaves NaN, which the callers treat as
 *  "fee unknown". */
export async function getFees(): Promise<Fees> {
  const raw = await request<Partial<Fees>>("/bank/fees");
  return {
    userTransactionFee: Number(raw.userTransactionFee),
    serviceTransactionFee: Number(raw.serviceTransactionFee),
  };
}