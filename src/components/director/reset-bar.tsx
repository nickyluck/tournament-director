"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { apiMutate } from "@/hooks/use-tournament";
import type { TournamentPublic } from "@/lib/tournament/types";

export function ResetBar({
  onUpdate,
}: {
  onUpdate: (t: TournamentPublic) => void;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/30 p-4">
      <p className="text-sm text-muted-foreground">
        Un seul tournoi à la fois. Réinitialiser efface joueurs, tables et timer.
      </p>
      <Button
        className="mt-3"
        variant="outline"
        disabled={pending}
        onClick={() => {
          if (!window.confirm("Réinitialiser complètement le tournoi ?")) return;
          startTransition(async () => {
            const next = await apiMutate("/api/tournament/config", {
              method: "DELETE",
            });
            onUpdate(next);
          });
        }}
      >
        Nouveau tournoi
      </Button>
    </div>
  );
}
