import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dcdcuzfvnafvqazbjcor.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dc7d2wJF_UK_n6qtz_uUvw_FnYb5s_W";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== AUTH HELPER =====================

async function requireAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ===================== ADD TO FAVORITES =====================

/**
 * Inserts a game into the favorites table.
 * The user_id column has DEFAULT auth.uid(), so Supabase fills it automatically.
 * RLS INSERT policy (auth.uid() = user_id) is the enforcement layer.
 *
 * @param {number} gameId
 * @param {object} snapshot - { name, image, rating, released, genres, tags }
 * @returns {{ success: boolean, error?: string }}
 */
export async function addToFavorites(gameId, snapshot = {}) {
  const user = await requireAuth();
  if (!user) {
    return { success: false, error: "You must be signed in to add favorites." };
  }

  const { error } = await supabase
    .from("favorites")
    .insert({
      game_id: gameId,
      game_name: snapshot.name || null,
      game_image: snapshot.image || null,
      game_rating: snapshot.rating || null,
      game_released: snapshot.released || null,
      game_genres: snapshot.genres || [],
      game_tags: snapshot.tags || []
    });

  if (error) {
    console.error("addToFavorites error:", error.message);
    return { success: false, error: "Failed to add favorite. Please try again." };
  }

  return { success: true };
}

// ===================== REMOVE FROM FAVORITES =====================

/**
 * Removes a game from the favorites table.
 * RLS ensures a user can only delete their own rows.
 *
 * @param {number} gameId
 * @returns {{ success: boolean, error?: string }}
 */
export async function removeFromFavorites(gameId) {
  const user = await requireAuth();
  if (!user) {
    return { success: false, error: "You must be signed in." };
  }

  const { error } = await supabase
    .from("favorites")
    .delete()
    .eq("game_id", gameId);

  if (error) {
    console.error("removeFromFavorites error:", error.message);
    return { success: false, error: "Failed to remove favorite. Please try again." };
  }

  return { success: true };
}

// ===================== TOGGLE FAVORITE =====================

/**
 * Toggles a game in the favorites table.
 * Checks if the game is already favorited, then adds or removes accordingly.
 *
 * @param {number} gameId
 * @param {object} snapshot - { name, image, rating, released, genres, tags }
 * @returns {{ added: boolean, error?: string }}
 */
export async function toggleFavorite(gameId, snapshot = {}) {
  const user = await requireAuth();
  if (!user) {
    return { added: false, error: "You must be signed in to manage favorites." };
  }

  // Check if already favorited
  const { data: existing, error: fetchError } = await supabase
    .from("favorites")
    .select("id")
    .eq("game_id", gameId)
    .maybeSingle();

  if (fetchError) {
    console.error("toggleFavorite check error:", fetchError.message);
    return { added: false, error: "Failed to check favorites. Please try again." };
  }

  // Already favorited -> remove
  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("toggleFavorite remove error:", deleteError.message);
      return { added: false, error: "Failed to remove favorite. Please try again." };
    }

    return { added: false };
  }

  // Not favorited -> insert
  const { error: insertError } = await supabase
    .from("favorites")
    .insert({
      game_id: gameId,
      game_name: snapshot.name || null,
      game_image: snapshot.image || null,
      game_rating: snapshot.rating || null,
      game_released: snapshot.released || null,
      game_genres: snapshot.genres || [],
      game_tags: snapshot.tags || []
    });

  if (insertError) {
    console.error("toggleFavorite insert error:", insertError.message);
    return { added: false, error: "Failed to add favorite. Please try again." };
  }

  return { added: true };
}

// ===================== FETCH USER FAVORITES =====================

/**
 * Fetches all favorites for the logged-in user.
 * RLS policy 'Users can view their own favorites' ensures only the
 * authenticated user's rows are returned — no manual user_id filter needed.
 *
 * @returns {{ favorites: Array, error?: string }}
 */
export async function fetchUserFavorites() {
  const user = await requireAuth();
  if (!user) {
    return { favorites: [], error: "You must be signed in to view your favorites." };
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchUserFavorites error:", error.message);
    return { favorites: [], error: "Failed to load favorites. Please try again." };
  }

  return { favorites: data || [] };
}

// ===================== CHECK IF FAVORITED =====================

/**
 * Checks if a game is in the user's favorites.
 * Returns false for unauthenticated users (RLS would reject the query anyway).
 *
 * @param {number} gameId
 * @returns {boolean}
 */
export async function isFavorite(gameId) {
  const user = await requireAuth();
  if (!user) return false;

  const { data, error } = await supabase
    .from("favorites")
    .select("id")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}
