import {
  ensureUserProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getPlanEndDate, verifyRazorpaySignature } from "@/lib/payments";
import { getPaymentPlan } from "@/lib/payment-plans";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
      plan: planId,
    } = await request.json();

    const plan = getPaymentPlan(planId);
    if (!plan || !orderId || !paymentId || !signature) {
      return Response.json({ error: "INVALID_PAYMENT" }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    await ensureUserProfile(user);

    const verified = verifyRazorpaySignature({
      orderId,
      paymentId,
      signature,
    });

    if (!verified) {
      return Response.json({ error: "SIGNATURE_MISMATCH" }, { status: 400 });
    }

    const admin = getSupabaseAdmin();
    const startsAt = new Date();
    const endsAt = getPlanEndDate(planId, startsAt);

    const { error: subscriptionError } = await admin
      .from("subscriptions")
      .update({
        razorpay_payment_id: paymentId,
        razorpay_signature: signature,
        status: "active",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        updated_at: startsAt.toISOString(),
      })
      .eq("razorpay_order_id", orderId)
      .eq("user_id", user.id);

    if (subscriptionError) {
      throw subscriptionError;
    }

    const { error: userError } = await admin
      .from("users")
      .update({ plan: planId, updated_at: startsAt.toISOString() })
      .eq("id", user.id);

    if (userError) {
      throw userError;
    }

    return Response.json({
      ok: true,
      plan: planId,
      ends_at: endsAt.toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        error: "VERIFY_FAILED",
        message: error?.message || "Could not verify payment.",
      },
      { status: 500 }
    );
  }
}
