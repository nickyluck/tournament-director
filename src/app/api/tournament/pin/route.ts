import { jsonError, jsonOk } from "@/lib/api";
import { regeneratePin } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonOk(await regeneratePin());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur PIN", 500);
  }
}
