import { jsonOk } from "@/lib/api";
import { getPublicTournament, tickTimerIfNeeded } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await tickTimerIfNeeded();
  const tournament = await getPublicTournament();
  return jsonOk(tournament);
}
