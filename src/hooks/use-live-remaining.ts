"use client";

import { useEffect, useState } from "react";
import { effectiveRemainingMs } from "@/lib/tournament/client-timer";
import type { TournamentPublic } from "@/lib/tournament/types";

/** Local smooth countdown derived from server timer anchors. */
export function useLiveRemaining(tournament: TournamentPublic | null): number {
  const [ms, setMs] = useState(0);

  useEffect(() => {
    if (!tournament) {
      setMs(0);
      return;
    }

    const tick = () => setMs(effectiveRemainingMs(tournament));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [tournament]);

  return ms;
}
