import {
  getPublicTournament,
  subscribe,
  tickTimerIfNeeded,
} from "@/lib/tournament/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const encoder = new TextEncoder();
  let closed = false;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let tick: ReturnType<typeof setInterval> | undefined;
  let unsubscribe: (() => void) | undefined;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      try {
        await tickTimerIfNeeded();
        send("tournament", await getPublicTournament());
      } catch (err) {
        send("error", {
          message: err instanceof Error ? err.message : "Erreur SSE",
        });
      }

      unsubscribe = subscribe((tournament) => {
        send("tournament", tournament);
      });

      heartbeat = setInterval(() => {
        send("ping", { at: Date.now() });
      }, 15_000);

      // Auto-advance blinds when countdown reaches 0.
      tick = setInterval(() => {
        void tickTimerIfNeeded().catch(() => undefined);
      }, 1000);
    },
    cancel() {
      closed = true;
      if (heartbeat) clearInterval(heartbeat);
      if (tick) clearInterval(tick);
      unsubscribe?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
