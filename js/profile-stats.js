import { supabase } from "./supabase-client.js";

const els = {
  played:   document.getElementById("played-count"),
  favorite: document.getElementById("favorite-count"),
  lists:    document.getElementById("lists-count"),
  diary:    document.getElementById("diary-count"),
  reviews:  document.getElementById("reviews-count"),
};

async function countRows(table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

function setText(el, value) {
  if (el) el.textContent = value;
}

async function loadProfileStats() {
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.warn("Profile stats: not signed in");
      return;
    }

    const [played, favorite, lists, reviews] = await Promise.all([
      countRows("played_games", user.id),
      countRows("favorites",    user.id),
      countRows("lists",        user.id),
      countRows("reviews",      user.id),
    ]);

    setText(els.played,   played);
    setText(els.favorite, favorite);
    setText(els.lists,    lists);
    setText(els.reviews,  reviews);

    // Diary is not yet implemented in the database
    setText(els.diary, 0);

  } catch (err) {
    console.error("Failed to load profile stats:", err.message);
  }
}

loadProfileStats();
