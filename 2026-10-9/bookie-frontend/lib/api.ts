// Server-only access to the logical core. The base URL never reaches the
// browser: pages render on the server and mutations go through /api/session.

const API_URL = process.env.API_URL ?? "http://localhost:8000/api/v1";

export type Txn = {
  username: string;
  timestamp: string;
  before: number;
  after: number;
  service: { id: number; name: string };
};

export type User = {
  username: string;
  balance: number;
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
): Promise<Page<T>> {
  return request<Page<T>>(`${path}?page=${page}&limit=${limit}`);
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

export const getTransactions = (page: number, limit: number) =>
  getPage<Txn>("/transactions", page, limit);

/** Balances are fixed-point decimals on the core, so they arrive as strings
 *  ("990"); coerce them so every consumer sees numbers. */
const toUser = (raw: { username: string; balance: string | number }): User => ({
  username: raw.username,
  balance: Number(raw.balance),
});

export async function getUsers(
  page: number,
  limit: number,
): Promise<Page<User>> {
  const res = await getPage<{ username: string; balance: string }>(
    "/users",
    page,
    limit,
  );
  return { ...res, data: res.data.map(toUser) };
}

/** Walk the whole user list — the only place balances are exposed. */
export async function getAllUsers(): Promise<User[]> {
  return (await fetchAll<{ username: string; balance: string }>("/users")).map(
    toUser,
  );
}

/** The core answers 200 with the account, or 404, so existence is all we learn. */
export async function userExists(username: string): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/users/${username}`, { cache: "no-store" });
  } catch {
    throw new ApiError(0, "UNREACHABLE", "The ledger core is unreachable.");
  }
  if (res.ok) return true;
  if (res.status === 404) return false;
  throw new ApiError(0, "UNKNOWN", "The core gave an unexpected response.");
}