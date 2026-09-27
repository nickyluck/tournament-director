import { jsonError, jsonOk } from "@/lib/api";
import { movePlayer } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      playerId?: string;
      toTableId?: string;
      toSeat?: number;
    };
    if (!body.playerId || !body.toTableId || body.toSeat == null) {
      return jsonError("playerId, toTableId et toSeat requis");
    }
    return jsonOk(await movePlayer(body.playerId, body.toTableId, Number(body.toSeat)));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Déplacement impossible");
  }
}
