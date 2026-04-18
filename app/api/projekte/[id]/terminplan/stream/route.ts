// ─── GET /api/projekte/[id]/terminplan/stream ───────────────────────────────
//
// Server-Sent-Events-Endpoint für Terminplan-Realtime-Updates. Clients
// abonnieren per EventSource und bekommen für jedes Write im Service-Layer
// ein JSON-Event im SSE-Format (`data: {...}\n\n`). Heartbeats alle 25s
// verhindern, dass Proxies/Railway idle connections zumachen.
//
// Architektur:
//   - Auth + Permission-Check wie bei jedem anderen Projekt-Endpoint.
//   - ReadableStream als Response-Body. Der Writer wird bei `subscribe`
//     registriert; bei `abort`/`cancel` wieder entfernt.
//   - Runtime = nodejs, weil Edge-Streams in Next.js mit langlaufenden
//     Verbindungen bisher weniger zuverlässig sind.

import { NextRequest } from "next/server";
import { requireSession } from "@/lib/api-helpers";
import { requireProjectAccess } from "@/lib/projekte/permissions";
import { subscribe } from "@/lib/terminplan/realtime";
import type { ScheduleEvent } from "@/lib/terminplan/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, error } = await requireSession();
  if (error) return error;

  const { id: projectId } = await params;
  const access = await requireProjectAccess(session!.user, projectId, "read");
  if (access.error) return access.error;

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const teardown = (controller: ReadableStreamDefaultController<Uint8Array>) => {
    if (closed) return;
    closed = true;
    if (unsubscribe) {
      unsubscribe();
      unsubscribe = null;
    }
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    try {
      controller.close();
    } catch {
      // Controller war schon geschlossen — egal.
    }
  };

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: ScheduleEvent) => {
        if (closed) return;
        try {
          const line = `data: ${JSON.stringify(event)}\n\n`;
          controller.enqueue(encoder.encode(line));
        } catch {
          // Enqueue kann werfen, wenn der Controller schon zu ist —
          // dann soll broadcast() diesen Writer aus der Registry werfen.
          throw new Error("stream closed");
        }
      };

      // Initialer Handshake als SSE-Kommentar. Der Client kann daran
      // erkennen, dass die Verbindung steht, bekommt aber noch kein Event.
      try {
        controller.enqueue(encoder.encode(`: connected\n\n`));
      } catch {
        // Falls der Client schon weg ist, bevor wir überhaupt antworten.
        teardown(controller);
        return;
      }

      // Heartbeat-Kommentare halten Proxies wach (Railway, nginx, CF).
      heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`: heartbeat\n\n`));
        } catch {
          teardown(controller);
        }
      }, 25_000);

      unsubscribe = subscribe(projectId, send);

      // Client hat abgebrochen (Tab zu, Navigation, Netzwerk-Drop) —
      // Writer sofort deregistrieren, damit wir keine toten Callbacks halten.
      req.signal.addEventListener("abort", () => {
        teardown(controller);
      });
    },
    cancel() {
      // Wird aufgerufen, wenn der Consumer den Stream droppt, ohne einen
      // Abort-Signal zu senden (z.B. Next.js-intern beim Request-Ende).
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
      if (heartbeat) {
        clearInterval(heartbeat);
        heartbeat = null;
      }
      closed = true;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      // nginx-Reverse-Proxy darf nicht buffern, sonst kommen Events
      // erst nach Verbindungsende beim Client an.
      "X-Accel-Buffering": "no",
    },
  });
}
