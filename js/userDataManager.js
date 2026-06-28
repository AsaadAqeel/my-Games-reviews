import { supabase } from "./supabase-client.js";

// ===================== AUTH =====================

async function requireAuth() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

export async function getCurrentUser() {
  return requireAuth();
}

export async function getProfileUsername() {
  const user = await requireAuth();
  if (!user) return null;
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();
    if (error || !data?.username) return null;
    return data.username;
  } catch {
    return null;
  }
}

// ===================== EVENT BUS =====================

const listeners = {};

function emit(event, payload) {
  (listeners[event] || []).forEach(fn => fn(payload));
}

export function on(event, fn) {
  if (!listeners[event]) listeners[event] = [];
  listeners[event].push(fn);
  return () => { listeners[event] = listeners[event].filter(f => f !== fn); };
}

// ===================== GENERIC READ =====================

/**
 * Fetches all rows from a table for the current user.
 * RLS handles user isolation.
 */
export async function fetchTable(tableName, opts = {}) {
  const user = await requireAuth();
  if (!user) return { data: [], error: "You must be signed in." };

  let query = supabase.from(tableName).select(opts.select || "*");

  if (opts.filters) {
    for (const [col, val] of Object.entries(opts.filters)) {
      query = query.eq(col, val);
    }
  }

  const orderCol = opts.order || "created_at";
  query = query.order(orderCol, { ascending: opts.ascending ?? false });

  const { data, error } = await query;

  if (error) {
    console.error(`fetchTable(${tableName}) error:`, error.message);
    return { data: [], error: `Failed to load ${tableName}.` };
  }

  return { data: data || [] };
}

// ===================== GENERIC INSERT =====================

/**
 * Inserts a row into any table. RLS and user_id default are handled server-side.
 */
export async function save(tableName, payload) {
  const user = await requireAuth();
  if (!user) return { data: null, error: "You must be signed in." };

  const { data, error } = await supabase
    .from(tableName)
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error(`save(${tableName}) error:`, error.message);
    return { data: null, error: `Failed to save to ${tableName}.` };
  }

  emit("change", { table: tableName, action: "insert", data });
  return { data, error: null };
}

// ===================== GENERIC DELETE =====================

/**
 * Deletes rows matching a filter condition.
 */
export async function remove(tableName, match) {
  const user = await requireAuth();
  if (!user) return { success: false, error: "You must be signed in." };

  let query = supabase.from(tableName).delete();
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }

  const { error } = await query;

  if (error) {
    console.error(`remove(${tableName}) error:`, error.message);
    return { success: false, error: `Failed to delete from ${tableName}.` };
  }

  emit("change", { table: tableName, action: "delete", match });
  return { success: true, error: null };
}

// ===================== SINGLE ROW LOOKUP =====================

/**
 * Finds one row by a match condition.
 */
export async function findOne(tableName, match) {
  const user = await requireAuth();
  if (!user) return { data: null, error: "You must be signed in." };

  let query = supabase.from(tableName).select("*");
  for (const [col, val] of Object.entries(match)) {
    query = query.eq(col, val);
  }
  query = query.maybeSingle();

  const { data, error } = await query;

  if (error) {
    console.error(`findOne(${tableName}) error:`, error.message);
    return { data: null, error: `Failed to query ${tableName}.` };
  }

  return { data, error: null };
}

// ===================== FAVORITES =====================

/**
 * Checks if a game is in the user's favorites.
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

/**
 * Toggles a game in the favorites table.
 * Returns { added: true } if added, { added: false } if removed.
 */
export async function toggleFavorite(gameId, snapshot = {}) {
  const user = await requireAuth();
  if (!user) {
    return { added: false, error: "You must be signed in to manage favorites." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("favorites")
    .select("id")
    .eq("game_id", gameId)
    .maybeSingle();

  if (fetchError) {
    console.error("toggleFavorite check error:", fetchError.message);
    return { added: false, error: "Failed to check favorites." };
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("favorites")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("toggleFavorite remove error:", deleteError.message);
      return { added: false, error: "Failed to remove favorite." };
    }

    emit("change", { table: "favorites", action: "remove", gameId });
    return { added: false };
  }

  const { error: insertError } = await supabase
    .from("favorites")
    .insert({ game_id: gameId });

  if (insertError) {
    console.error("toggleFavorite insert error:", insertError.message);
    return { added: false, error: "Failed to add favorite." };
  }

  emit("change", { table: "favorites", action: "add", gameId });
  return { added: true };
}

// ===================== PLAYED GAMES =====================

/**
 * Checks if a game is in the user's played_games.
 */
export async function isPlayed(gameId) {
  const user = await requireAuth();
  if (!user) return false;

  const { data, error } = await supabase
    .from("played_games")
    .select("id")
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

/**
 * Toggles a game in the played_games table.
 * Returns { added: true } if added, { added: false } if removed.
 */
export async function togglePlayed(gameId, snapshot = {}) {
  const user = await requireAuth();
  if (!user) {
    return { added: false, error: "You must be signed in to track played games." };
  }

  const { data: existing, error: fetchError } = await supabase
    .from("played_games")
    .select("id")
    .eq("game_id", gameId)
    .maybeSingle();

  if (fetchError) {
    console.error("togglePlayed check error:", fetchError.message);
    return { added: false, error: "Failed to check played status." };
  }

  if (existing) {
    const { error: deleteError } = await supabase
      .from("played_games")
      .delete()
      .eq("id", existing.id);

    if (deleteError) {
      console.error("togglePlayed remove error:", deleteError.message);
      return { added: false, error: "Failed to remove from played." };
    }

    emit("change", { table: "played_games", action: "remove", gameId });
    return { added: false };
  }

  const { error: insertError } = await supabase
    .from("played_games")
    .insert({ game_id: gameId });

  if (insertError) {
    console.error("togglePlayed insert error:", insertError.message);
    return { added: false, error: "Failed to add to played." };
  }

  emit("change", { table: "played_games", action: "add", gameId });
  return { added: true };
}

// ===================== REVIEWS =====================

/**
 * Saves a review to the reviews table (upsert: one review per user per game).
 */
export async function saveReview(gameId, reviewData) {
  const user = await requireAuth();
  if (!user) return { data: null, error: "You must be signed in to write a review." };

  const payload = {
    game_id: gameId,
    rating: reviewData.rating,
    title: reviewData.title,
    body: reviewData.body
  };

  const { data: existing } = await supabase
    .from("reviews")
    .select("id")
    .eq("game_id", gameId)
    .maybeSingle();

  if (existing) {
    const { data, error } = await supabase
      .from("reviews")
      .update({
        rating: payload.rating,
        title: payload.title,
        body: payload.body
      })
      .eq("id", existing.id)
      .select()
      .single();

    if (error) {
      console.error("saveReview update error:", error.message);
      return { data: null, error: "Failed to save review." };
    }

    emit("change", { table: "reviews", action: "update", data });
    return { data, error: null };
  }

  const { data, error } = await supabase
    .from("reviews")
    .insert(payload)
    .select()
    .single();

  if (error) {
    console.error("saveReview insert error:", error.message);
    return { data: null, error: "Failed to save review." };
  }

  emit("change", { table: "reviews", action: "insert", data });
  return { data, error: null };
}

/**
 * Deletes a review by its id.
 */
export async function deleteReview(reviewId) {
  return remove("reviews", { id: reviewId });
}

/**
 * Fetches all reviews for a specific game.
 */
export async function fetchGameReviews(gameId) {
  return fetchTable("reviews", {
    filters: { game_id: gameId },
    order: "created_at",
    ascending: false
  });
}

/**
 * Fetches all reviews by the current user (across all games).
 */
export async function fetchAllUserReviews() {
  return fetchTable("reviews", {
    order: "created_at",
    ascending: false
  });
}

// ===================== LISTS =====================

/**
 * Fetches all list definitions for the current user.
 */
export async function fetchLists() {
  return fetchTable("lists", { order: "created_at", ascending: false });
}

/**
 * Creates a new list.
 */
export async function createList(name) {
  return save("lists", { list_name: name });
}

/**
 * Renames a list.
 */
export async function renameList(listId, newName) {
  const user = await requireAuth();
  if (!user) return { success: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("lists")
    .update({ list_name: newName })
    .eq("id", listId);

  if (error) {
    console.error("renameList error:", error.message);
    return { success: false, error: "Failed to rename list." };
  }

  emit("change", { table: "lists", action: "update", listId, newName });
  return { success: true, error: null };
}

/**
 * Deletes a list and its entries.
 */
export async function deleteList(listId) {
  const user = await requireAuth();
  if (!user) return { success: false, error: "You must be signed in." };

  await supabase.from("list_entries").delete().eq("list_id", listId);

  const { error } = await supabase.from("lists").delete().eq("id", listId);

  if (error) {
    console.error("deleteList error:", error.message);
    return { success: false, error: "Failed to delete list." };
  }

  emit("change", { table: "lists", action: "delete", listId });
  return { success: true, error: null };
}

/**
 * Fetches all game entries for a specific list.
 */
export async function fetchListGames(listId) {
  return fetchTable("list_entries", {
    filters: { list_id: listId },
    order: "created_at",
    ascending: false
  });
}

/**
 * Adds a game to a list (checks for duplicates).
 */
export async function addGameToList(listId, snapshot) {
  const user = await requireAuth();
  if (!user) return { success: false, error: "You must be signed in." };

  const { data: existing } = await supabase
    .from("list_entries")
    .select("id")
    .eq("list_id", listId)
    .eq("game_id", snapshot.id)
    .maybeSingle();

  if (existing) {
    return { success: false, error: "Game is already in this list." };
  }

  const { data, error } = await supabase
    .from("list_entries")
    .insert({
      list_id: listId,
      game_id: snapshot.id
    })
    .select()
    .single();

  if (error) {
    console.error("addGameToList error:", error.message);
    return { success: false, error: "Failed to add game to list." };
  }

  emit("change", { table: "list_entries", action: "insert", data });
  return { success: true, error: null };
}

/**
 * Removes a game from a list.
 */
export async function removeGameFromList(listId, gameId) {
  const user = await requireAuth();
  if (!user) return { success: false, error: "You must be signed in." };

  const { error } = await supabase
    .from("list_entries")
    .delete()
    .eq("list_id", listId)
    .eq("game_id", gameId);

  if (error) {
    console.error("removeGameFromList error:", error.message);
    return { success: false, error: "Failed to remove game from list." };
  }

  emit("change", { table: "list_entries", action: "delete", listId, gameId });
  return { success: true, error: null };
}

/**
 * Checks if a game is in a specific list.
 */
export async function isGameInList(listId, gameId) {
  const user = await requireAuth();
  if (!user) return false;

  const { data, error } = await supabase
    .from("list_entries")
    .select("id")
    .eq("list_id", listId)
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

// ===================== SYNC ALL (Page Load) =====================

/**
 * Pre-fetches all user data for the current session.
 * Returns cached state for setting UI elements on page load.
 */
export async function syncAll() {
  const user = await requireAuth();
  if (!user) {
    console.warn("[syncAll] No user session — returning empty state.");
    return {
      favorites: new Set(),
      played: new Set(),
      favoritesData: [],
      playedData: [],
      reviewsData: [],
      lists: [],
      listEntries: {}
    };
  }

  console.log("[syncAll] Fetching data for user:", user.id);

  try {
    const [favResult, playedResult, reviewsResult, listsResult] = await Promise.all([
      fetchTable("favorites"),
      fetchTable("played_games"),
      fetchTable("reviews", { order: "created_at", ascending: false }),
      fetchTable("lists")
    ]);

    if (favResult.error) console.error("[syncAll] favorites fetch error:", favResult.error);
    if (playedResult.error) console.error("[syncAll] played_games fetch error:", playedResult.error);
    if (reviewsResult.error) console.error("[syncAll] reviews fetch error:", reviewsResult.error);
    if (listsResult.error) console.error("[syncAll] lists fetch error:", listsResult.error);

    const favoritesData = favResult.data || [];
    const playedData = playedResult.data || [];
    const reviewsData = reviewsResult.data || [];
    const favoriteIds = new Set(favoritesData.map(r => Number(r.game_id)));
    const playedIds = new Set(playedData.map(r => Number(r.game_id)));

    console.log("[syncAll] Raw counts:", {
      favorites: favoritesData.length,
      played: playedData.length,
      reviews: reviewsData.length,
      lists: (listsResult.data || []).length
    });

    const lists = listsResult.data || [];

    // Pre-fetch list entries for all lists
    const listEntriesMap = {};
    if (lists.length > 0) {
      const entryPromises = lists.map(list =>
        fetchTable("list_entries", { filters: { list_id: list.id }, select: "game_id" })
      );
      const entryResults = await Promise.all(entryPromises);
      lists.forEach((list, i) => {
        if (entryResults[i].error) {
          console.error("[syncAll] list_entries fetch error for list", list.id + ":", entryResults[i].error);
        }
        listEntriesMap[list.id] = new Set((entryResults[i].data || []).map(r => Number(r.game_id)));
      });
    }

    return {
      favorites: favoriteIds,
      played: playedIds,
      favoritesData,
      playedData,
      reviewsData,
      lists,
      listEntries: listEntriesMap
    };
  } catch (err) {
    console.error("[syncAll] Unhandled error during sync:", err);
    return {
      favorites: new Set(),
      played: new Set(),
      favoritesData: [],
      playedData: [],
      reviewsData: [],
      lists: [],
      listEntries: {}
    };
  }
}

// ===================== AVERAGES (Client-side from reviews) =====================

/**
 * Computes average rating and review count for a game from fetched reviews.
 */
export function computeAverage(reviews) {
  if (!reviews || reviews.length === 0) return { average: null, count: 0 };
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return { average: sum / reviews.length, count: reviews.length };
}

/**
 * Computes all averages from a flat array of reviews grouped by game_id.
 */
export function computeAllAverages(reviews) {
  const grouped = {};
  for (const r of reviews) {
    if (!grouped[r.game_id]) grouped[r.game_id] = [];
    grouped[r.game_id].push(r);
  }
  const result = {};
  for (const [gid, revs] of Object.entries(grouped)) {
    const sum = revs.reduce((acc, r) => acc + r.rating, 0);
    result[gid] = { average: sum / revs.length, count: revs.length };
  }
  return result;
}
