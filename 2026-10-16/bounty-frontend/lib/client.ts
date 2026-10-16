// Browser-side client. The browser talks to the bank API directly
// (the API sends permissive CORS headers), so the base URL must be
// resolvable from the browser — not the compose-internal service name.
// NEXT_PUBLIC_BANK_API_URL is set in .env.local / docker-compose.
const BANK_BASE = process.env.NEXT_PUBLIC_BANK_API_URL ?? "";

export class WireError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WireError";
    this.status = status;
  }
}

/** Same ritual as the server's bank call, pointed at the bank API. */
export async function wire<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${BANK_BASE}${path}`, { ...init });
  } catch {
    throw new WireError(
      0,
      "The wire went quiet. Check the connection and try again.",
    );
  }

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    // Nothing legible came back.
  }

  if (!res.ok) {
    const detail = payload as { message?: string } | null;
    throw new WireError(
      res.status,
      detail?.message ?? "The wire came back unreadable.",
    );
  }

  return payload as T;
}

export function jsonInit(method: string, body: unknown): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

export function errorMessage(error: unknown, fallback: string): string {
  return error instanceof WireError ? error.message : fallback;
}
