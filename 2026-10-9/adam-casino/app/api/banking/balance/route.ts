import { NextResponse } from "next/server";

const bankingApiUrl = process.env.BANKING_API_URL ?? "http://10.151.0.85:3000/api/v1";

export async function GET(request: Request) {
  const username = new URL(request.url).searchParams.get("username");
  if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });

  try {
    const response = await fetch(`${bankingApiUrl}/users/${encodeURIComponent(username)}`, { cache: "no-store" });
    const body = await response.text();
    return new NextResponse(body, { status: response.status, headers: { "Content-Type": response.headers.get("content-type") ?? "application/json" } });
  } catch {
    return NextResponse.json({ error: "The banking service could not be reached." }, { status: 502 });
  }
}
