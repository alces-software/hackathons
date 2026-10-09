import { cookies } from "next/headers";

export const SESSION_COOKIE = "bookie_user";

/** Name under which the visitor currently holds the book, if any. */
export async function getSession(): Promise<string | null> {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}