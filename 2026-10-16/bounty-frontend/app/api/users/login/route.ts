import { failureResponse, login, readJsonBody } from "@/lib/bounty-api";
import type { Credentials } from "@/lib/types";

export async function POST(request: Request) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return Response.json(
      { error: "BAD_REQUEST", message: "The request was malformed" },
      { status: 400 },
    );
  }
  try {
    const data = await login(parsed.data as Credentials);
    return Response.json(data);
  } catch (error) {
    return failureResponse(error);
  }
}