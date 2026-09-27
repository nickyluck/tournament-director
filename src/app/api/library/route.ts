import { jsonError, jsonOk } from "@/lib/api";
import { getLibrary } from "@/lib/tournament/library";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return jsonOk(await getLibrary());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur bibliothèque", 500);
  }
}
