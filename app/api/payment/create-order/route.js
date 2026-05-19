import {
  ensureUserProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createRazorpayOrder, getPlanEndDate } from "@/lib/payments";
import { getPaymentPlan } from "@/lib/payment-plans";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { plan: planId } = await request.json();
    const plan = getPaymentPlan(planId);

    if (!plan) {
      return Response.json({ error: "INVALID_PLAN" }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    await ensureUserProfile(user);

    const receipt = `gm_${Date.now().toString(36)}_${user.id.slice(0, 8)}`;
    const { order, keyId } = await createRazorpayOrder({
      planId,
      receipt,
      notes: {
        user_id: user.id,
        plan: planId,
        product: "gita_marg",
      },
    });

    const startsAt = new Date();
    const endsAt = getPlanEndDate(planId, startsAt);
    const admin = getSupabaseAdmin();
    const { error } = await admin.from("subscriptions").insert({
      user_id: user.id,
      razorpay_order_id: order.id,
      plan: planId,
      amount_paise: plan.amountPaise,
      currency: plan.currency,
      status: "pending",
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
    });

    if (error) {
      throw error;
    }

    return Response.json({
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      plan,
      name: "Gita Marg",
      description: plan.displayPrice,
    });
  } catch (error) {
    return Response.json(
      {
        error: "ORDER_FAILED",
        message: error?.message || "Could not create payment order.",
      },
      { status: 500 }
    );
  }
}
