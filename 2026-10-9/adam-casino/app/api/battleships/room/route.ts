import { NextResponse } from "next/server";
import {
  applyBattleshipAction,
  createBattleshipRoom,
  getBattleshipRoom,
  joinBattleshipRoom,
  markBattleshipConnected,
  markBattleshipDisconnected,
  spectateBattleshipRoom,
  verifyBattleshipToken,
  viewBattleshipRoom,
  type BattleshipAction,
  type BattleshipRoom,
} from "../../../../lib/battleshipsMultiplayer";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

const isMember = (room: BattleshipRoom, id: string) => !!id && [...room.players, ...room.spectators].some((member) => member.id === id);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const room = getBattleshipRoom(code);
  if (!room) return errorResponse("Room not found.", 404);
  const id = verifyBattleshipToken(code, url.searchParams.get("playerToken") ?? "") ?? "";
  // Reject bad sessions up front. Failing inside the stream would make EventSource reconnect in a loop.
  if (!isMember(room, id)) return errorResponse("You are not in this room.", 403);

  if (url.searchParams.get("events") === "1") {
    const encoder = new TextEncoder();
    let last = 0;
    let lastWrite = Date.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    // Idempotent: abort, cancel and error paths can all call this, but presence is released only once.
    const stop = () => {
      if (closed) return;
      closed = true;
      if (timer) clearTimeout(timer);
      markBattleshipDisconnected(room.code, id);
    };
    const stream = new ReadableStream({
      start(controller) {
        // Spectators are ignored by markBattleshipConnected, so this only tracks players.
        markBattleshipConnected(room.code, id);
        const tick = () => {
          if (closed) return;
          try {
            const current = getBattleshipRoom(code);
            if (!current) {
              stop();
              controller.close();
              return;
            }
            if (current.updatedAt !== last) {
              last = current.updatedAt;
              lastWrite = Date.now();
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(viewBattleshipRoom(current, id))}\n\n`));
            } else if (Date.now() - lastWrite > 15000) {
              // Comment line keeps proxies from closing an idle connection.
              lastWrite = Date.now();
              controller.enqueue(encoder.encode(": ping\n\n"));
            }
          } catch {
            stop();
            try { controller.close(); } catch { /* already closed */ }
            return;
          }
          timer = setTimeout(tick, 500);
        };
        tick();
      },
      cancel() {
        stop();
      },
    });
    request.signal.addEventListener("abort", stop);
    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "Content-Type": "text/event-stream",
        "X-Accel-Buffering": "no",
      },
    });
  }

  try {
    return NextResponse.json(viewBattleshipRoom(room, id));
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "Could not read the room.", 403);
  }
}

export async function POST(request: Request) {
  let body: { action?: "create" | "join" | "spectate" | "move"; code?: string; playerToken?: string; name?: string; move?: BattleshipAction };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return errorResponse("The request must be valid JSON.");
  }

  try {
    if (body.action === "create") {
      const result = createBattleshipRoom(body.name ?? "");
      return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewBattleshipRoom(result.room, result.playerId) });
    }

    if (body.action === "join") {
      const existing = getBattleshipRoom(body.code ?? "");
      const existingId = verifyBattleshipToken(body.code ?? "", body.playerToken ?? "");
      if (existing && existingId && isMember(existing, existingId)) return errorResponse("That browser is already connected to this room.", 409);
      const result = joinBattleshipRoom(body.code ?? "", body.name ?? "");
      return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewBattleshipRoom(result.room, result.playerId) });
    }

    if (body.action === "spectate") {
      const result = spectateBattleshipRoom(body.code ?? "", body.name ?? "");
      return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewBattleshipRoom(result.room, result.playerId) });
    }

    if (body.action === "move") {
      const room = getBattleshipRoom(body.code ?? "");
      const id = verifyBattleshipToken(body.code ?? "", body.playerToken ?? "");
      if (!room) return errorResponse("Room not found.", 404);
      if (!id || !body.move) return errorResponse("A valid player session and move are required.", 403);
      applyBattleshipAction(room, id, body.move);
      // Moves answer with the bare view (not wrapped in { room }), unlike create/join.
      return NextResponse.json(viewBattleshipRoom(room, id));
    }

    return errorResponse("Unknown room action.");
  } catch (error) {
    return errorResponse(error instanceof Error ? error.message : "The room action failed.");
  }
}