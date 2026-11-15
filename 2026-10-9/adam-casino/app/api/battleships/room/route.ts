import { NextResponse } from "next/server";
import { applyBattleshipAction, createBattleshipRoom, getBattleshipRoom, joinBattleshipRoom, spectateBattleshipRoom, verifyBattleshipToken, viewBattleshipRoom, type BattleshipAction } from "../../../../lib/battleshipsMultiplayer";

function errorResponse(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function GET(request: Request) {
  const url = new URL(request.url); const code = url.searchParams.get("code") ?? ""; const room = getBattleshipRoom(code); if (!room) return errorResponse("Room not found.", 404);
  const id = verifyBattleshipToken(code, url.searchParams.get("playerToken") ?? "") ?? "";
  try {
    if (url.searchParams.get("events") === "1") {
      const encoder = new TextEncoder(); let last = 0; let timer: ReturnType<typeof setTimeout> | undefined; let closed = false;
      const stream = new ReadableStream({ start(controller) { const send = () => { if (closed) return; const current = getBattleshipRoom(code); if (!current) return controller.close(); if (current.updatedAt !== last) { last = current.updatedAt; controller.enqueue(encoder.encode(`data: ${JSON.stringify(viewBattleshipRoom(current, id))}\n\n`)); } timer = setTimeout(send, 500); }; send(); }, cancel() { closed = true; if (timer) clearTimeout(timer); } });
      request.signal.addEventListener("abort", () => { closed = true; if (timer) clearTimeout(timer); });
      return new Response(stream, { headers: { "Cache-Control": "no-cache, no-transform", Connection: "keep-alive", "Content-Type": "text/event-stream" } });
    }
    return NextResponse.json(viewBattleshipRoom(room, id));
  } catch (error) { return errorResponse(error instanceof Error ? error.message : "Could not read the room.", 403); }
}

export async function POST(request: Request) {
  let body: { action?: "create" | "join" | "spectate" | "move"; code?: string; playerToken?: string; name?: string; move?: BattleshipAction };
  try { body = await request.json() as typeof body; } catch { return errorResponse("The request must be valid JSON."); }
  try {
    if (body.action === "create") { const result = createBattleshipRoom(body.name ?? ""); return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewBattleshipRoom(result.room, result.playerId) }); }
    if (body.action === "join") { const existing = getBattleshipRoom(body.code ?? ""); const existingId = verifyBattleshipToken(body.code ?? "", body.playerToken ?? ""); if (existing && existingId && [...existing.players, ...existing.spectators].some((item) => item.id === existingId)) return errorResponse("That browser is already connected to this room.", 409); const result = joinBattleshipRoom(body.code ?? "", body.name ?? ""); return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewBattleshipRoom(result.room, result.playerId) }); }
    if (body.action === "spectate") { const result = spectateBattleshipRoom(body.code ?? "", body.name ?? ""); return NextResponse.json({ playerId: result.playerId, playerToken: result.playerToken, room: viewBattleshipRoom(result.room, result.playerId) }); }
    if (body.action === "move") { const room = getBattleshipRoom(body.code ?? ""); const id = verifyBattleshipToken(body.code ?? "", body.playerToken ?? ""); if (!room) return errorResponse("Room not found.", 404); if (!id || !body.move) return errorResponse("A valid player session and move are required.", 403); applyBattleshipAction(room, id, body.move); return NextResponse.json(viewBattleshipRoom(room, id)); }
    return errorResponse("Unknown room action.");
  } catch (error) { return errorResponse(error instanceof Error ? error.message : "The room action failed."); }
}
