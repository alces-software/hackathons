// Browser-side client for our own /api route handlers.

export class WireError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "WireError";
    this.status = status;
  }
}

/** Same ritual as the server's bank call, pointed at our own routes. */
export async function wire<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init });
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