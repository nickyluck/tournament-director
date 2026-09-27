import { jsonError, jsonOk } from "@/lib/api";
import { addRosterPlayer, deleteRosterPlayer } from "@/lib/tournament/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { name?: string };
    if (!body.name) return jsonError("Nom requis");
    return jsonOk(await addRosterPlayer(body.name));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur d'ajout à l’annuaire");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) return jsonError("id requis");
    return jsonOk(await deleteRosterPlayer(body.id));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression");
  }
}
