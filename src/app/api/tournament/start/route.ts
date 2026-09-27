import { jsonError, jsonOk } from "@/lib/api";
import { startTournament } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonOk(await startTournament());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Impossible de démarrer");
  }
}
