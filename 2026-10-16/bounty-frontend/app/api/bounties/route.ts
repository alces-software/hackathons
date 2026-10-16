import type { NextRequest } from "next/server";
import {
  bountyQueryOf,
  createBounty,
  failureResponse,
  listBounties,
  readJsonBody,
} from "@/lib/bounty-api";
import type { BountyDraft, Page, Bounty } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const data: Page<Bounty> = await listBounties(
      bountyQueryOf(request.nextUrl.searchParams),
    );
    return Response.json(data);
  } catch (error) {
    return failureResponse(error);
  }
}

export async function POST(request: NextRequest) {
  const parsed = await readJsonBody(request);
  if (!parsed.ok) {
    return Response.json(
      { error: "BAD_REQUEST", message: "The request was malformed" },
      { status: 400 },
    );
  }
  try {
    const data: Bounty = await createBounty(parsed.data as BountyDraft);
    return Response.json(data, { status: 201 });
  } catch (error) {
    return failureResponse(error);
  }
}