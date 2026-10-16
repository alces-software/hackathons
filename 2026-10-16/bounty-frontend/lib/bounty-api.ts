// Server-side client for the bank API. Route handlers in app/api
// proxy these calls, so the browser never needs the API URL and
// CORS never enters the picture.

import type {
  ApiErrorCode,
  Bounty,
  BountyDraft,
  Credentials,
  Page,
  PublicUser,
  SettleBody,
} from "@/lib/types";

/** Base of the bank API. Set in .env.local (see BOUNTY_API_URL). */
const BASE = process.env.BOUNTY_API_URL || "http://localhost:3000/api/v1";

/** Thrown when the bank answers with anything other than 2xx. */
export class UpstreamError extends Error {
  readonly status: number;
  readonly errorCode: ApiErrorCode | null;

  constructor(status: number, errorCode: ApiErrorCode | null, message: string) {
    super(message);
    this.name = "UpstreamError";
    this.status = status;
    this.errorCode = errorCode;
  }
}

async function call<T>(
  method: string,
  path: string,
  query?: URLSearchParams,
  body?: unknown,
): Promise<T> {
  let res: Response;
  try {
    const search = query?.toString();
    res = await fetch(search ? `${BASE}${path}?${search}` : `${BASE}${path}`, {
      method,
      cache: "no-store",
      ...(body === undefined
        ? {}
        : {
            headers: { "content-type": "application/json" },
            body: JSON.stringify(body),
          }),
    });
  } catch {
    throw new UpstreamError(502, null, "The wire to the bank is down.");
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // The bank sent nothing we can read. Handled below.
  }

  if (!res.ok) {
    const detail = payload as { error?: ApiErrorCode; message?: string } | null;
    throw new UpstreamError(
      res.status,
      detail?.error ?? null,
      detail?.message ?? "The bank sent back unreadable wire.",
    );
  }

  return payload as T;
}

export async function listBounties(
  opts: { page?: number; limit?: number; completed?: boolean } = {},
): Promise<Page<Bounty>> {
  const query = new URLSearchParams();
  if (opts.page) query.set("page", String(Math.max(1, Math.floor(opts.page))));
  if (opts.limit)
    query.set(
      "limit",
      String(Math.min(100, Math.max(1, Math.floor(opts.limit)))),
    );
  if (opts.completed !== undefined)
    query.set("completed", String(opts.completed));
  return call("GET", "/bounties", query);
}

export async function createBounty(draft: BountyDraft): Promise<Bounty> {
  return call("POST", "/bounties", undefined, draft);
}

export async function completeBounty(
  id: number,
  body: SettleBody,
): Promise<Bounty> {
  return call("PATCH", `/bounties/${id}/complete`, undefined, body);
}

export async function listUsers(
  opts: { page?: number; limit?: number; sort?: "asc" | "desc" } = {},
): Promise<Page<PublicUser>> {
  const query = new URLSearchParams();
  if (opts.page) query.set("page", String(Math.max(1, Math.floor(opts.page))));
  if (opts.limit)
    query.set(
      "limit",
      String(Math.min(100, Math.max(1, Math.floor(opts.limit)))),
    );
  if (opts.sort) query.set("orderByBalance", opts.sort);
  return call("GET", "/users", query);
}

export async function login(user: Credentials): Promise<{ message: string }> {
  return call("POST", "/users/login", undefined, user);
}

// ── helpers for the route handlers ─────────────────────────────

export async function readJsonBody(
  request: Request,
): Promise<{ ok: true; data: unknown } | { ok: false }> {
  try {
    return { ok: true, data: await request.json() };
  } catch {
    return { ok: false };
  }
}

function intParam(search: URLSearchParams, name: string): number | undefined {
  const raw = search.get(name);
  if (raw === null || !/^\d+$/.test(raw)) return undefined;
  return Number(raw);
}

export function bountyQueryOf(search: URLSearchParams): {
  page?: number;
  limit?: number;
  completed?: boolean;
} {
  const completedRaw = search.get("completed");
  return {
    page: intParam(search, "page"),
    limit: intParam(search, "limit"),
    completed:
      completedRaw === "true"
        ? true
        : completedRaw === "false"
          ? false
          : undefined,
  };
}

export function usersQueryOf(search: URLSearchParams): {
  page?: number;
  limit?: number;
  sort?: "asc" | "desc";
} {
  const orderByBalance = search.get("orderByBalance");
  return {
    page: intParam(search, "page"),
    limit: intParam(search, "limit"),
    sort: orderByBalance === "asc" ? "asc" : orderByBalance === "desc" ? "desc" : undefined,
  };
}

/** Turn a thrown bank call into a response that keeps the bank's shape. */
export function failureResponse(error: unknown): Response {
  if (error instanceof UpstreamError) {
    return Response.json(
      {
        error: error.errorCode ?? "INTERNAL_SERVER_ERROR",
        message: error.message,
      },
      { status: error.status },
    );
  }
  return Response.json(
    { error: "INTERNAL_SERVER_ERROR", message: "An unexpected error occurred" },
    { status: 500 },
  );
}