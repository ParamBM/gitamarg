import {
  ensureUserProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { guidanceId } = await request.json();

    if (!guidanceId) {
      return Response.json({ error: "GUIDANCE_REQUIRED" }, { status: 400 });
    }

    const { user } = await getAuthenticatedUser();
    if (!user) {
      return Response.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    const profile = await ensureUserProfile(user);
    const isPaid = profile.plan === "monthly" || profile.plan === "annual";
    const isAdmin = profile.role === "admin";

    if (!isPaid && !isAdmin) {
      return Response.json({ error: "PAYWALL_REQUIRED" }, { status: 402 });
    }

    const { error } = await admin
      .from("guidance")
      .update({ is_shared: true })
      .eq("id", guidanceId)
      .eq("user_id", user.id);

    if (error) {
      throw error;
    }

    return Response.json({ ok: true });
  } catch {
    return Response.json(
      { error: "SHARE_FAILED", message: "Could not mark guidance as shared." },
      { status: 500 }
    );
  }
}
