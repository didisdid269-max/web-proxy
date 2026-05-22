import { SERVICE_WORKER_SCRIPT } from "@/lib/service-worker";

export const runtime = "edge";

export async function GET() {
  return new Response(SERVICE_WORKER_SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}
