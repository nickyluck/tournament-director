"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { useLanInfo } from "@/hooks/use-lan";

export function DirectorHeader({
  name,
  status,
  connected,
  pin,
}: {
  name: string;
  status: string;
  connected: boolean;
  pin: string;
}) {
  const lan = useLanInfo();
  const statusLabel =
    status === "setup"
      ? "Préparation"
      : status === "running"
        ? "En cours"
        : "Terminé";

  return (
    <header className="border-b border-border bg-card/60 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Tournament Director
            </p>
            <h1 className="mt-1 font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              {name}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={status === "running" ? "default" : "secondary"}>
              {statusLabel}
            </Badge>
            <Badge variant={connected ? "outline" : "destructive"}>
              {connected ? "Live SSE" : "Hors sync"}
            </Badge>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">PIN mobile (éliminations)</p>
            <p className="font-mono text-3xl font-semibold tracking-[0.35em]">{pin}</p>
          </div>
          <div className="text-sm sm:text-right">
            <p className="text-muted-foreground">Accès LAN</p>
            <p className="font-mono text-xs sm:text-sm">
              {lan?.lanUrls[0] ?? lan?.localUrl ?? "…"}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 sm:justify-end">
              <Link className="underline underline-offset-4" href="/setup">
                Configuration
              </Link>
              <Link className="underline underline-offset-4" href="/players">
                Joueurs
              </Link>
              <Link className="underline underline-offset-4" href="/clock">
                Horloge salle
              </Link>
              <Link className="underline underline-offset-4" href="/mobile">
                Mobile floor
              </Link>
              <Link className="underline underline-offset-4" href="/standings">
                Classement
              </Link>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
