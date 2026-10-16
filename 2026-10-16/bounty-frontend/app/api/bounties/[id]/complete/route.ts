import {
  completeBounty,
  failureResponse,
  readJsonBody,
} from "@/lib/bounty-api";
import type { Bounty, SettleBody } from "@/lib/types";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return Response.json(
      { error: "BAD_REQUEST", message: "The request was malformed" },
      { status: 400 },
    );
  }
  try {
    const data: Bounty = await completeBounty(
      Number(id),
      parsed.data as SettleBody,
    );
    return Response.json(data);
  } catch (error) {
    return failureResponse(error);
  }
}