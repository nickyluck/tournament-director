import { jsonError, jsonOk } from "@/lib/api";
import { deleteStructure, saveStructure } from "@/lib/tournament/library";
import type { BlindLevel } from "@/lib/tournament/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      id?: string;
      name?: string;
      blinds?: BlindLevel[];
    };
    if (!body.name) return jsonError("Nom de structure requis");
    if (!body.blinds) return jsonError("Blindes requises");
    return jsonOk(
      await saveStructure({
        id: body.id,
        name: body.name,
        blinds: body.blinds,
      }),
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur d'enregistrement");
  }
}

export async function DELETE(request: Request) {
  try {
    const body = (await request.json()) as { id?: string };
    if (!body.id) return jsonError("id requis");
    return jsonOk(await deleteStructure(body.id));
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de suppression");
  }
}
