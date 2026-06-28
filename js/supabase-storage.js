import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dcdcuzfvnafvqazbjcor.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dc7d2wJF_UK_n6qtz_uUvw_FnYb5s_W";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== AUTH HELPERS =====================

/**
 * Returns the currently authenticated user, or null if not logged in.
 * This is the primary gate before any user_games query.
 */
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) {
    console.error("getUser error:", error.message);
    return null;
  }
  return user;
}

// ===================== TOGGLE FAVORITE =====================

/**
 * Toggles a game in the user_games table with type='favorite'.
 * If the game is already a favorite, it removes it.
 * If not, it inserts a new record.
 *
 * RLS policy: INSERT/DELETE WHERE user_id = auth.uid()
 *
 * @param {number} gameId - RAWG game ID
 * @param {object} snapshot - Game metadata to store (name, image, etc.)
 * @returns {{ added: boolean, error?: string }}
 */
export async function toggleFavorite(gameId, snapshot = {}) {
  const user = await getCurrentUser();
  if (!user) {
    return { added: false, error: "You must be signed in to manage favorites." };
  }

  // Check if already favorited
  const { data: existing, error: fetchError } = await supabase
    .from("user_games")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .eq("type", "favorite")
    .maybeSingle();

  if (fetchError) {
    console.error("toggleFavorite fetch error:", fetchError.message);
    return { added: false, error: "Failed to check favorites. Please try again." };
  }

  // Already a favorite -> remove it
  if (existing) {
    const { error: deleteError } = await supabase
      .from("user_games")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("toggleFavorite delete error:", deleteError.message);
      return { added: false, error: "Failed to remove favorite. Please try again." };
    }

    return { added: false };
  }

  // Not a favorite -> insert it
  const { error: insertError } = await supabase
    .from("user_games")
    .insert({
      user_id: user.id,
      game_id: gameId,
      type: "favorite",
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

// ===================== FETCH USER GAMES =====================

/**
 * Fetches all games of a given type for the current user.
 * RLS ensures only the user's own rows are returned.
 *
 * @param {string} type - 'favorite', 'played', or 'list' (matches your user_games.type)
 * @returns {{ games: Array, error?: string }}
 */
export async function fetchUserGames(type = "favorite") {
  const user = await getCurrentUser();
  if (!user) {
    return { games: [], error: "You must be signed in to view your games." };
  }

  const { data, error } = await supabase
    .from("user_games")
    .select("*")
    .eq("user_id", user.id)
    .eq("type", type)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("fetchUserGames error:", error.message);
    return { games: [], error: "Failed to load your games. Please try again." };
  }

  return { games: data || [] };
}

// ===================== CHECK IF FAVORITED =====================

/**
 * Returns true if the game is in the user's favorites.
 * Useful for rendering a filled/empty star on game cards.
 *
 * @param {number} gameId
 * @returns {boolean}
 */
export async function isFavorite(gameId) {
  const user = await getCurrentUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from("user_games")
    .select("id")
    .eq("user_id", user.id)
    .eq("game_id", gameId)
    .eq("type", "favorite")
    .maybeSingle();

  if (error) return false;
  return !!data;
}

// ===================== RENDER EXAMPLE =====================

/**
 * Example: render a list of favorite games into a container element.
 * Call this on your favorites.html page.
 */
export async function renderFavorites(container) {
  container.innerHTML = '<div class="spinner"></div>';

  const { games, error } = await fetchUserGames("favorite");

  if (error) {
    container.innerHTML = `<div class="status-message error">${error}</div>`;
    return;
  }

  if (games.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state__title">No favorites yet</div>
        <p>Browse games and tap the star to add favorites.</p>
      </div>`;
    return;
  }

  container.innerHTML = "";

  for (const game of games) {
    const card = document.createElement("div");
    card.className = "game-card";

    const link = document.createElement("a");
    link.href = "game.html?id=" + game.game_id;

    if (game.game_image) {
      const img = document.createElement("img");
      img.className = "game-card__image";
      img.src = game.game_image;
      img.alt = game.game_name || "Game";
      img.loading = "lazy";
      link.appendChild(img);
    }

    const body = document.createElement("div");
    body.className = "game-card__body";

    const title = document.createElement("div");
    title.className = "game-card__title";
    title.textContent = game.game_name || "Game #" + game.game_id;
    body.appendChild(title);

    if (game.game_rating != null) {
      const rating = document.createElement("div");
      rating.className = "game-card__rawg-score";
      rating.textContent = "\u2605 " + Number(game.game_rating).toFixed(1);
      body.appendChild(rating);
    }

    link.appendChild(body);
    card.appendChild(link);
    container.appendChild(card);
  }
}
