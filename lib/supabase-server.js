import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getSupabaseAdmin, supabaseAnonKey, supabaseUrl } from "@/lib/supabase";

export async function createSupabaseRouteClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase public credentials are not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export async function getAuthenticatedUser() {
  const supabase = await createSupabaseRouteClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { user: null, error };
  }

  return { user, error: null };
}

export async function ensureUserProfile(user) {
  const admin = getSupabaseAdmin();
  const metadata = user.user_metadata || {};
  const fallbackName = user.email?.split("@")[0] || "Gita Marg seeker";

  const { data, error } = await admin
    .from("users")
    .upsert(
      {
        id: user.id,
        email: user.email,
        name: metadata.full_name || metadata.name || fallbackName,
        avatar_url: metadata.avatar_url || metadata.picture || null,
      },
      { onConflict: "id" }
    )
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}
