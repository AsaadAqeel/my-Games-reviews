import { supabase } from "./supabase-client.js";

const els = {
  username: document.getElementById("profile-username"),
  joined:   document.getElementById("profile-joined"),
  played:   document.getElementById("played-count"),
  favorite: document.getElementById("favorite-count"),
  lists:    document.getElementById("lists-count"),
  diary:    document.getElementById("diary-count"),
  reviews:  document.getElementById("reviews-count"),
};

function setText(el, value) {
  if (el) el.textContent = value;
}

function formatJoinDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `Joined ${month} ${year}`;
}

function avatarUrl(username) {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4`;
}

async function countRows(table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

async function loadProfile() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn("Profile: not signed in");
      return;
    }

    // Fetch profile + counts in parallel
    const [profileResult, played, favorite, lists, reviews] = await Promise.all([
      supabase
        .from("profiles")
        .select("username, created_at")
        .eq("id", user.id)
        .maybeSingle(),
      countRows("played_games", user.id),
      countRows("favorites",    user.id),
      countRows("lists",        user.id),
      countRows("reviews",      user.id),
    ]);

    // Profile data
    if (profileResult.error) throw profileResult.error;

    const profile = profileResult.data;
    if (profile) {
      const name = profile.username || user.email?.split("@")[0] || "User";
      setText(els.username, name);
      setText(els.joined, formatJoinDate(profile.created_at));

      const avatar = document.querySelector(".profile-avatar__img");
      if (avatar) avatar.src = avatarUrl(name);
    }

    // Stat counts
    setText(els.played,   played);
    setText(els.favorite, favorite);
    setText(els.lists,    lists);
    setText(els.reviews,  reviews);
    setText(els.diary,    0); // Not yet implemented

  } catch (err) {
    console.error("Failed to load profile:", err.message);
  }
}

loadProfile();
