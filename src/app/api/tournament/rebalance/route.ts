import { jsonError, jsonOk } from "@/lib/api";
import { forceRebalance } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    return jsonOk(await forceRebalance());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Rééquilibrage impossible");
  }
}
