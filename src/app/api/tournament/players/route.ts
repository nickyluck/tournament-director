import { jsonError, jsonOk } from "@/lib/api";
import { addPlayer, enrollPlayers, removePlayer } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      names?: string[];
      saveToRoster?: boolean;
    };

    if (Array.isArray(body.names)) {
      return jsonOk(
        await enrollPlayers(body.names, { saveToRoster: body.saveToRoster }),
      );
    }
    if (!body.name) return jsonError("Nom requis");
    return jsonOk(
      await addPlayer(body.name, { saveToRoster: body.saveToRoster }),
    );
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
