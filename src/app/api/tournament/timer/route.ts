import { jsonError, jsonOk } from "@/lib/api";
import { controlTimer, tickTimerIfNeeded } from "@/lib/tournament/store";
import type { TimerAction } from "@/lib/tournament/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ACTIONS = new Set<TimerAction>(["play", "pause", "plus1", "next", "prev"]);

export async function POST(request: Request) {
  try {
    await tickTimerIfNeeded();
    const body = (await request.json()) as {
      action?: TimerAction;
      pin?: string;
      fromMobile?: boolean;
    };
    if (!body.action || !ACTIONS.has(body.action)) {
      return jsonError("Action timer invalide");
    }
    return jsonOk(
      await controlTimer(body.action, {
        pin: body.pin,
        requirePin: Boolean(body.fromMobile),
      }),
    );
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur timer");
  }
}
