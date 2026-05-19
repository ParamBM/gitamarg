import { getPaymentReadiness } from "@/lib/payments";

export const runtime = "nodejs";

function isAdminRequest(request) {
  const configuredToken = process.env.ADMIN_ACCESS_TOKEN;
  if (!configuredToken) {
    return true;
  }

  return request.headers.get("x-admin-token") === configuredToken;
}

export async function POST(request) {
  if (!isAdminRequest(request)) {
    return Response.json({ error: "ADMIN_TOKEN_REQUIRED" }, { status: 401 });
  }

  const readiness = getPaymentReadiness();

  return Response.json({
    activated: readiness.enabled,
    enabled: readiness.enabled,
    keyIdPresent: readiness.keyIdPresent,
    keySecretPresent: readiness.keySecretPresent,
    appUrlPresent: readiness.appUrlPresent,
    disabled: readiness.disabled,
    message: readiness.enabled
      ? "Payment gateway is active across the app."
      : "Add Razorpay env keys, then activate again.",
  });
}
