import { NextResponse } from "next/server";
import { applyUnoAction, createUnoRoom, getUnoRoom, joinUnoRoom, spectateUnoRoom, verifyPlayerToken, viewUnoRoom, type UnoAction, type UnoRuleset } from "../../../../lib/unoMultiplayer";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const playerId = verifyPlayerToken(code, url.searchParams.get("playerToken") ?? "") ?? "";
  const room = getUnoRoom(code);
  if (!room) return errorResponse("Room not found.", 404);
  try {
    if (url.searchParams.get("events") === "1") {
      const encoder = new TextEncoder();
      let lastUpdatedAt = 0;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let closed = false;
      const stream = new ReadableStream({
        start(controller) {
          const sendUpdate = () => {
            if (closed) return;
            const currentRoom = getUnoRoom(code);
            if (!currentRoom) {
              controller.close();
              return;
            }
            if (currentRoom.updatedAt !== lastUpdatedAt) {
              lastUpdatedAt = currentRoom.updatedAt;
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(viewUnoRoom(currentRoom, playerId))}\n\n`));
            }
            timer = setTimeout(sendUpdate, 500);
          };
          sendUpdate();
        },
        cancel() {
          closed = true;
          if (timer) clearTimeout(timer);
        },
      });
      request.signal.addEventListener("abort", () => {
        closed = true;
        if (timer) clearTimeout(timer);
      });
      return new Response(stream, {
        headers: {
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
          "Content-Type": "text/event-stream",
        },
      });
    }
    return NextResponse.json(viewUnoRoom(room, playerId));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not read the room.", 403);
  }
}

export async function POST(request: Request) {
  let body: { action?: "create" | "join" | "spectate" | "move"; code?: string; playerId?: string; playerToken?: string; name?: string; ruleset?: UnoRuleset; maxPlayers?: number; move?: UnoAction };
  try {
    body = await request.json() as typeof body;
  } catch {
    return errorResponse("The request must be valid JSON.");
  }

  try {
    if (body.action === "create") {
      const result = createUnoRoom(body.name ?? "", body.ruleset ?? "regular", body.maxPlayers ?? 2);
      return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewUnoRoom(result.room, result.playerId) });
    }
    if (body.action === "join") {
      const existingRoom = getUnoRoom(body.code ?? "");
      const existingPlayerId = verifyPlayerToken(body.code ?? "", body.playerToken ?? "");
      if (existingRoom && existingPlayerId && (existingRoom.players.some((player) => player.id === existingPlayerId) || existingRoom.spectators.some((spectator) => spectator.id === existingPlayerId))) {
        return errorResponse("That browser is already connected to this room.", 409);
      }
      const result = joinUnoRoom(body.code ?? "", body.name ?? "");
      return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewUnoRoom(result.room, result.playerId) });
    }
    if (body.action === "spectate") {
      const result = spectateUnoRoom(body.code ?? "", body.name ?? "");
      return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewUnoRoom(result.room, result.playerId) });
    }
    if (body.action === "move") {
      const room = getUnoRoom(body.code ?? "");
      if (!room) return errorResponse("Room not found.", 404);
      const playerId = verifyPlayerToken(body.code ?? "", body.playerToken ?? "");
      if (!playerId || !body.move) return errorResponse("A valid player session and move are required.", 403);
      applyUnoAction(room, playerId, body.move);
      return NextResponse.json(viewUnoRoom(room, playerId));
    }
    return errorResponse("Unknown room action.");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "The room action failed.");
  }
}