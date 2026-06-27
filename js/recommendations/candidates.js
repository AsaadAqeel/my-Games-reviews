// Depends on:
//   RAWG_API_KEY and RAWG_BASE_URL from js/config.js

import { RAWG_API_KEY, RAWG_BASE_URL } from "../config.js";

export async function getCandidateGames(profile, likedGameIds) {
  const topGenres = Object.entries(profile.genres)
    .filter(([, w]) => w > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([slug]) => slug);

  try {
    let url;
    if (topGenres.length > 0) {
      const params = new URLSearchParams({
        genres: topGenres.join(","),
        ordering: "-rating",
        page_size: "40",
        key: RAWG_API_KEY
      });
      url = `${RAWG_BASE_URL}/games?${params}`;
    } else {
      const params = new URLSearchParams({
        ordering: "-added",
        page_size: "40",
        key: RAWG_API_KEY
      });
      url = `${RAWG_BASE_URL}/games?${params}`;
    }

    const res = await fetch(url);
    if (!res.ok) throw new Error(`RAWG ${res.status}`);
    const data = await res.json();

    const results = Array.isArray(data.results) ? data.results : [];
    const seen = new Set();

    return results.filter(game => {
      if (!game || game.id == null) return false;
      if (likedGameIds.has(game.id)) return false;
      if (seen.has(game.id)) return false;
      seen.add(game.id);
      return true;
    });
  } catch {
    return [];
  }
}
