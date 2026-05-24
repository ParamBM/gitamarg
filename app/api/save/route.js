import {
  ensureUserProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { guidanceId, bookmarked = true } = await request.json();

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

    const { data, error } = await admin
      .from("guidance")
      .update({ is_bookmarked: Boolean(bookmarked) })
      .eq("id", guidanceId)
      .eq("user_id", user.id)
      .select("id,is_bookmarked")
      .single();

    if (error) {
      throw error;
    }

    if (bookmarked) {
      await admin
        .from("users")
        .update({
          total_saved: (profile.total_saved || 0) + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("id", user.id);
    }

    return Response.json({ saved: data });
  } catch {
    return Response.json(
      { error: "SAVE_FAILED", message: "Could not update bookmark." },
      { status: 500 }
    );
  }
}
