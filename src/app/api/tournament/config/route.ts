import { jsonError, jsonOk } from "@/lib/api";
import { resetTournament, updateSetup } from "@/lib/tournament/store";
import type { BlindLevel } from "@/lib/tournament/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as {
      name?: string;
      startingStack?: number;
      seatsPerTable?: number;
      finalTableSeats?: number;
      configuredTableCount?: number;
      breakOrder?: string[];
      blinds?: BlindLevel[];
      reset?: boolean;
    };

    if (body.reset) {
      return jsonOk(await resetTournament());
    }

    const tournament = await updateSetup({
      name: body.name,
      startingStack: body.startingStack,
      seatsPerTable: body.seatsPerTable,
      finalTableSeats: body.finalTableSeats,
      configuredTableCount: body.configuredTableCount,
      breakOrder: body.breakOrder,
      blinds: body.blinds,
    });
    return jsonOk(tournament);
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de configuration");
  }
}

export async function DELETE() {
  try {
    return jsonOk(await resetTournament());
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Erreur de réinitialisation", 500);
  }
}
