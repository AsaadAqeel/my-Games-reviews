// Depends on:
//   localStorage key "favoriteGames" from js/storage.js (getAllFavorites)
//   localStorage key "playedGames"   from js/storage.js (getAllPlayed)
//   localStorage key "gameReviews"   from js/storage.js (getAllReviews)
// Snapshot shape: { id, name, genres: [{slug,name}], tags: [{slug,name}], ... }
// Review shape:   { rating, genres: [{slug,name}], tags: [{slug,name}], ... }

import { getAllFavorites, getAllPlayed, getAllReviews } from "../storage.js";

function slugFrom(item) {
  if (!item) return null;
  if (item.slug) return item.slug;
  if (item.name) return item.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return null;
}

function collectGenresTags(gameObj) {
  const genres = [];
  const tags = [];
  if (Array.isArray(gameObj.genres)) {
    for (const g of gameObj.genres) {
      const s = slugFrom(g);
      if (s) genres.push(s);
    }
  }
  if (Array.isArray(gameObj.tags)) {
    for (const t of gameObj.tags) {
      const s = slugFrom(t);
      if (s) tags.push(s);
    }
  }
  return { genres, tags };
}

function addWeight(profile, genres, tags, weight) {
  for (const g of genres) {
    profile.genres[g] = (profile.genres[g] || 0) + weight;
  }
  for (const t of tags) {
    profile.tags[t] = (profile.tags[t] || 0) + weight;
  }
}

export function buildTasteProfile() {
  const profile = { genres: {}, tags: {} };
  const likedGameIds = new Set();

  const favorites = getAllFavorites();
  const played = getAllPlayed();
  const reviews = getAllReviews();

  const reviewedIds = new Set();

  // --- Reviews (most specific signal) ---
  if (reviews && typeof reviews === "object") {
    for (const gameIdStr of Object.keys(reviews)) {
      const reviewList = reviews[gameIdStr];
      if (!Array.isArray(reviewList) || reviewList.length === 0) continue;

      const gameId = Number(gameIdStr);
      likedGameIds.add(gameId);
      reviewedIds.add(gameId);

      // Use the latest review's rating
      const latest = reviewList.reduce((a, b) => (b.date > a.date ? b : a));
      const rating = latest.rating;

      let weight = 0;
      if (rating >= 4) weight = 3;
      else if (rating === 3) weight = 1;
      else weight = -2;

      // Use genres/tags stored on the review object
      const { genres, tags } = collectGenresTags(latest);
      addWeight(profile, genres, tags, weight);
    }
  }

  // --- Favorites ---
  if (Array.isArray(favorites)) {
    for (const game of favorites) {
      if (!game || game.id == null) continue;
      const id = Number(game.id);
      likedGameIds.add(id);

      // Skip if already processed via a positive review
      if (reviewedIds.has(id)) {
        const reviewList = reviews[String(id)];
        if (Array.isArray(reviewList) && reviewList.length > 0) {
          const latest = reviewList.reduce((a, b) => (b.date > a.date ? b : a));
          if (latest.rating >= 3) continue; // already weighted through review
        }
      }

      const { genres, tags } = collectGenresTags(game);
      addWeight(profile, genres, tags, 3);
    }
  }

  // --- Played-only (no review, not favorited) ---
  if (Array.isArray(played)) {
    for (const game of played) {
      if (!game || game.id == null) continue;
      const id = Number(game.id);
      likedGameIds.add(id);

      // Skip if already favorited or reviewed
      if (reviewedIds.has(id)) continue;
      const isFav = Array.isArray(favorites) && favorites.some(f => f && Number(f.id) === id);
      if (isFav) continue;

      const { genres, tags } = collectGenresTags(game);
      addWeight(profile, genres, tags, 1);
    }
  }

  return { profile, likedGameIds };
}
