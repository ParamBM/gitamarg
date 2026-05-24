import {
  ensureUserProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function GET() {
  try {
    const { user } = await getAuthenticatedUser();

    if (!user) {
      return Response.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    const admin = getSupabaseAdmin();
    await ensureUserProfile(user);

    const { data, error } = await admin
      .from("guidance")
      .select(
        [
          "id",
          "problem_text",
          "shloka_id",
          "chapter",
          "verse",
          "sanskrit",
          "transliteration",
          "meaning_english",
          "meaning_hindi",
          "advice",
          "is_bookmarked",
          "is_shared",
          "created_at",
        ].join(",")
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      throw error;
    }

    return Response.json({ history: data || [] });
  } catch (error) {
    console.error("[History API Error]:", error);
    return Response.json(
      { error: "HISTORY_FAILED", message: "Could not load history." },
      { status: 500 }
    );
  }
}
