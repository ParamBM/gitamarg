import { getShlokaById } from "@/lib/shlokas";
import { pickShlokaId, writePersonalGuidance } from "@/lib/gemini";
import {
  ensureUserProfile,
  getAuthenticatedUser,
} from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const { problem, userId } = await request.json();
    const cleanProblem = String(problem || "").trim();

    if (!cleanProblem || cleanProblem.length < 8) {
      return Response.json(
        { error: "PROBLEM_REQUIRED", message: "Please describe your situation." },
        { status: 400 }
      );
    }

    const { user } = await getAuthenticatedUser();

    if (!user) {
      return Response.json({ error: "LOGIN_REQUIRED" }, { status: 401 });
    }

    if (userId && userId !== user.id) {
      return Response.json({ error: "USER_MISMATCH" }, { status: 403 });
    }

    const admin = getSupabaseAdmin();
    const profile = await ensureUserProfile(user);
    const isPaid = profile.plan === "monthly" || profile.plan === "annual";
    let quota = {
      allowed: true,
      used: 0,
      limit: 9999,
      is_day_one: false,
    };

    if (!isPaid) {
      const { data, error } = await admin.rpc("check_and_increment_quota", {
        p_user_id: user.id,
      });

      if (error) {
        throw error;
      }

      quota = data;

      if (!quota?.allowed) {
        return Response.json({ error: "QUOTA_EXCEEDED", quota }, { status: 429 });
      }
    }

    const shlokaId = await pickShlokaId(cleanProblem);
    const shloka = getShlokaById(shlokaId);

    if (!shloka) {
      return Response.json({ error: "SHLOKA_NOT_FOUND" }, { status: 500 });
    }

    const advice = await writePersonalGuidance(cleanProblem, shloka);

    const { data: saved, error: saveError } = await admin
      .from("guidance")
      .insert({
        user_id: user.id,
        problem_text: cleanProblem,
        problem_embedding: null,
        shloka_id: shloka.id,
        chapter: shloka.chapter,
        verse: shloka.verse,
        sanskrit: shloka.sanskrit,
        transliteration: shloka.transliteration,
        meaning_english: shloka.meaning_english,
        meaning_hindi: shloka.meaning_hindi,
        advice,
      })
      .select("id")
      .single();

    if (saveError) {
      throw saveError;
    }

    await admin
      .from("users")
      .update({
        total_questions: (profile.total_questions || 0) + 1,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    return Response.json({
      guidanceId: saved.id,
      chapter: shloka.chapter,
      verse: shloka.verse,
      sanskrit: shloka.sanskrit,
      transliteration: shloka.transliteration,
      meaning_english: shloka.meaning_english,
      translation: shloka.translation || shloka.meaning_english,
      meaning_hindi: isPaid ? shloka.meaning_hindi : null,
      advice,
      quota,
      plan: profile.plan,
    });
  } catch (error) {
    const message =
      error?.message === "GEMINI_API_KEY is not configured." ||
      error?.message === "Supabase service credentials are not configured."
        ? error.message
        : "Could not generate guidance right now.";

    return Response.json({ error: "SERVER_ERROR", message }, { status: 500 });
  }
}
