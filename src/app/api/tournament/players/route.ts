import { jsonError, jsonOk } from "@/lib/api";
import { addPlayer, removePlayer } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string };
    if (!body.name) return jsonError("Nom requis");
    return jsonOk(await addPlayer(body.name));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur d'inscription");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { playerId?: string };
    if (!body.playerId) return jsonError("playerId requis");
    return jsonOk(await removePlayer(body.playerId));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression");
  }
}
