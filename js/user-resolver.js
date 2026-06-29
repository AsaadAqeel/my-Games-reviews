import { supabase } from "./supabase-client.js";

export async function resolveUser() {
  const urlParams = new URLSearchParams(window.location.search);
  const usernameParam = urlParams.get("username") || urlParams.get("user_id");

  if (usernameParam) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, created_at")
      .eq("username", usernameParam)
      .maybeSingle();

    if (error) {
      console.error("resolveUser error:", error.message);
      return null;
    }
    return data;
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("resolveUser profile lookup error:", error.message);
    return null;
  }

  return data;
}
