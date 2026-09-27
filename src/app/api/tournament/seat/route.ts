import { jsonError, jsonOk } from "@/lib/api";
import { seatPlayers } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonOk(await seatPlayers());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Placement impossible");
  }
}
