"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Player } from "@/lib/tournament/types";

export function EliminateDialog({
  open,
  onOpenChange,
  player,
  candidates,
  pending,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player: Player | null;
  candidates: Player[];
  pending?: boolean;
  onConfirm: (killerId: string | null) => void;
}) {
  const [killerId, setKillerId] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setKillerId("");
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Éliminer {player?.name ?? ""}</DialogTitle>
          <DialogDescription>
            Indiquez optionnellement le killer (joueur qui a éliminé).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-2">
          <label className="text-sm font-medium" htmlFor="killer-select">
            Killer
          </label>
          <select
            id="killer-select"
            className="flex h-9 w-full rounded-lg border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            value={killerId}
            onChange={(e) => setKillerId(e.target.value)}
            disabled={pending}
          >
            <option value="">Aucun</option>
            {candidates.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => onOpenChange(false)}
          >
            Annuler
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={pending || !player}
            onClick={() => onConfirm(killerId || null)}
          >
            Confirmer l’élimination
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
