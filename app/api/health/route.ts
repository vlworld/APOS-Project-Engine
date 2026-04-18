/**
 * Healthcheck-Endpoint — beruehrt weder Auth noch DB.
 *
 * Zweck:
 *  - Railway-Healthcheck kann zuverlaessig 200 erwarten, auch wenn DB
 *    gerade nicht erreichbar ist.
 *  - Externe Monitoring-Tools (Uptime-Checks) haben einen stabilen Pfad.
 *
 * Gibt 200 mit minimalem Body zurueck — keine Seiteneffekte.
 */
export async function GET() {
  return new Response(
    JSON.stringify({ status: "ok", service: "apos", timestamp: new Date().toISOString() }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
}
