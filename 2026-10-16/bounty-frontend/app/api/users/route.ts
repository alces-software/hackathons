import type { NextRequest } from "next/server";
import {
  failureResponse,
  listUsers,
  usersQueryOf,
} from "@/lib/bounty-api";
import type { Page, PublicUser } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const data: Page<PublicUser> = await listUsers(
      usersQueryOf(request.nextUrl.searchParams),
    );
    return Response.json(data);
  } catch (error) {
    return failureResponse(error);
  }
}