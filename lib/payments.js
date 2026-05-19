import crypto from "node:crypto";
import { PAYMENT_PLANS, getPaymentPlan } from "@/lib/payment-plans";

export function getPaymentReadiness() {
  const keyId = process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "";
  const keySecret = process.env.RAZORPAY_KEY_SECRET || "";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const disabled = process.env.PAYMENTS_DISABLED === "true";

  return {
    enabled: Boolean(keyId && keySecret && !disabled),
    disabled,
    keyIdPresent: Boolean(keyId),
    keySecretPresent: Boolean(keySecret),
    appUrlPresent: Boolean(appUrl),
    keyId,
    plans: PAYMENT_PLANS,
  };
}

export async function createRazorpayOrder({ planId, receipt, notes = {} }) {
  const plan = getPaymentPlan(planId);
  const readiness = getPaymentReadiness();

  if (!plan) {
    throw new Error("Invalid payment plan.");
  }

  if (!readiness.enabled) {
    throw new Error("Razorpay is not configured.");
  }

  const credentials = Buffer.from(
    `${readiness.keyId}:${process.env.RAZORPAY_KEY_SECRET}`
  ).toString("base64");

  const response = await fetch("https://api.razorpay.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      amount: plan.amountPaise,
      currency: plan.currency,
      receipt,
      notes,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.description || "Could not create Razorpay order.");
  }

  return { order: data, plan, keyId: readiness.keyId };
}

export function verifyRazorpaySignature({ orderId, paymentId, signature }) {
  const secret = process.env.RAZORPAY_KEY_SECRET;

  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET is not configured.");
  }

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature || "");

  if (expectedBuffer.length !== signatureBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

export function getPlanEndDate(planId, startsAt = new Date()) {
  const plan = getPaymentPlan(planId);
  if (!plan) {
    throw new Error("Invalid payment plan.");
  }

  const endsAt = new Date(startsAt);
  endsAt.setDate(endsAt.getDate() + plan.durationDays);
  return endsAt;
}
