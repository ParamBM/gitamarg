import { getPaymentReadiness } from "@/lib/payments";

export const runtime = "nodejs";

export async function GET() {
  const readiness = getPaymentReadiness();

  return Response.json({
    enabled: readiness.enabled,
    keyIdPresent: readiness.keyIdPresent,
    appUrlPresent: readiness.appUrlPresent,
    keyId: readiness.enabled ? readiness.keyId : null,
    plans: readiness.plans,
  });
}
