import { jsonError, jsonOk } from "@/lib/api";
import { eliminatePlayer } from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      playerId?: string;
      pin?: string;
      fromMobile?: boolean;
      killerId?: string | null;
    };
    if (!body.playerId) return jsonError("playerId requis");
    return jsonOk(
      await eliminatePlayer(body.playerId, {
        pin: body.pin,
        requirePin: Boolean(body.fromMobile),
        killerId: body.killerId ?? null,
      }),
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Élimination impossible");
  }
}
