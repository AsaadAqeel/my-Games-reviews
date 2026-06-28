// Taste profile builder — Supabase-backed
//
// Data sources (all from userDataManager.syncAll()):
//   favoritesData  — full rows from the favorites table
//   playedData     — full rows from the played_games table
//   reviewsData    — full rows from the reviews table (ordered by created_at desc)
//
// Supabase column mapping:
//   game_genres: JSONB array of { slug, name }
//   game_tags:   JSONB array of { slug, name }
//   rating:      integer 1-5 (reviews table)

import { on } from "../userDataManager.js";

// ===================== HELPERS =====================

function slugFrom(item) {
  if (!item) return null;
  if (item.slug) return item.slug;
  if (item.name) return item.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return null;
}

function extractSlugs(arr) {
  if (!Array.isArray(arr)) return [];
  const out = [];
  for (const item of arr) {
    const s = slugFrom(item);
    if (s) out.push(s);
  }
  return out;
}

function collectGenresTags(gameObj) {
  return {
    genres: extractSlugs(gameObj.game_genres || gameObj.genres),
    tags: extractSlugs(gameObj.game_tags || gameObj.tags)
  };
}

function addWeight(profile, genres, tags, weight) {
  for (const g of genres) {
    profile.genres[g] = (profile.genres[g] || 0) + weight;
  }
  for (const t of tags) {
    profile.tags[t] = (profile.tags[t] || 0) + weight;
  }
}

// ===================== PROFILE BUILDER =====================

let cachedProfile = null;
let cachedLikedIds = null;

/**
 * Builds the taste profile from Supabase data.
 *
 * @param {object} data - { favoritesData, playedData, reviewsData } from syncAll()
 * @returns {{ profile: {genres, tags}, likedGameIds: Set }}
 */
export function buildTasteProfile(data = {}) {
  const favoritesData = data.favoritesData || [];
  const playedData = data.playedData || [];
  const reviewsData = data.reviewsData || [];

  const profile = { genres: {}, tags: {} };
  const likedGameIds = new Set();
  const reviewedIds = new Set();

  // --- Reviews (most specific signal) ---
  // Group by game_id, keep latest per game (reviewsData is ordered created_at desc)
  const reviewsByGame = new Map();
  for (const review of reviewsData) {
    const gid = Number(review.game_id);
    if (!reviewsByGame.has(gid)) {
      reviewsByGame.set(gid, review);
    }
  }

  for (const [gameId, review] of reviewsByGame) {
    likedGameIds.add(gameId);
    reviewedIds.add(gameId);

    const rating = review.rating;
    let weight = 0;
    if (rating >= 4) weight = 3;
    else if (rating === 3) weight = 1;
    else weight = -2;

    const { genres, tags } = collectGenresTags(review);
    addWeight(profile, genres, tags, weight);
  }

  // --- Favorites ---
  for (const game of favoritesData) {
    const id = Number(game.game_id);
    if (!id) continue;
    likedGameIds.add(id);

    // Skip if already processed via a positive review
    if (reviewedIds.has(id)) {
      const review = reviewsByGame.get(id);
      if (review && review.rating >= 3) continue;
    }

    const { genres, tags } = collectGenresTags(game);
    addWeight(profile, genres, tags, 3);
  }

  // --- Played-only (no review, not favorited) ---
  for (const game of playedData) {
    const id = Number(game.game_id);
    if (!id) continue;
    likedGameIds.add(id);

    if (reviewedIds.has(id)) continue;
    const isFav = favoritesData.some(f => Number(f.game_id) === id);
    if (isFav) continue;

    const { genres, tags } = collectGenresTags(game);
    addWeight(profile, genres, tags, 1);
  }

  cachedProfile = profile;
  cachedLikedIds = likedGameIds;

  return { profile, likedGameIds };
}

/**
 * Returns the last-built profile without re-computing.
 * Useful if callers need a synchronous snapshot after the first async build.
 */
export function getCachedProfile() {
  return {
    profile: cachedProfile || { genres: {}, tags: {} },
    likedGameIds: cachedLikedIds || new Set()
  };
}

// ===================== REACTIVE LISTENER =====================

let unsubscribe = null;
let onChangeCallback = null;

/**
 * Subscribes to userDataManager "change" events so the profile
 * auto-rebuilds whenever the user rates, favorites, or plays a game.
 *
 * @param {function} fn - Called with the new { profile, likedGameIds } after each rebuild.
 * @param {function} fetchData - Async function that returns { favoritesData, playedData, reviewsData }.
 * @returns {function} Unsubscribe function.
 */
export function watchTasteProfile(fn, fetchData) {
  onChangeCallback = fn;

  if (unsubscribe) unsubscribe();

  unsubscribe = on("change", async (evt) => {
    // Only react to changes on tables that affect the taste profile
    const relevant = evt.table === "favorites" || evt.table === "played_games" || evt.table === "reviews";
    if (!relevant) return;

    if (!fetchData) return;
    const data = await fetchData();
    const result = buildTasteProfile(data);
    if (onChangeCallback) onChangeCallback(result);
  });

  return () => {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
    onChangeCallback = null;
  };
}
