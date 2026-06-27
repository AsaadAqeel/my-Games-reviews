// Depends on:
//   localStorage key "favoriteGames" from js/storage.js
//   localStorage key "playedGames"   from js/storage.js
//   localStorage key "gameReviews"   from js/storage.js
//   js/recommendations/tasteProfile.js  (buildTasteProfile)
//   js/recommendations/candidates.js    (getCandidateGames)
//   js/recommendations/score.js         (rankRecommendations)
//   js/recommendations/diversify.js     (diversify)
//   renderCuratedCard from js/app.js    (existing card component)
//   js/config.js                        (RAWG_API_KEY, RAWG_BASE_URL)

import { buildTasteProfile } from "./tasteProfile.js";
import { getCandidateGames } from "./candidates.js";
import { rankRecommendations } from "./score.js";
import { diversify } from "./diversify.js";

const CACHE_KEY = "recommendationsCache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getStateHash() {
  try {
    const fav = localStorage.getItem("favoriteGames") || "";
    const played = localStorage.getItem("playedGames") || "";
    const reviews = localStorage.getItem("gameReviews") || "";
    let hash = 0;
    const str = fav + played + reviews;
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash;
  } catch {
    return 0;
  }
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !cached.timestamp) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    if (cached.hash !== getStateHash()) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      hash: getStateHash(),
      data
    }));
  } catch {
    // storage full or unavailable
  }
}

function clearCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}

function setLoading(container) {
  container.innerHTML = "";
  const wrapper = document.createElement("div");
  wrapper.className = "status-message";
  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.justifyContent = "center";
  wrapper.style.gap = "0.75rem";
  const spinner = document.createElement("div");
  spinner.className = "spinner";
  spinner.style.margin = "0";
  spinner.style.flexShrink = "0";
  wrapper.appendChild(spinner);
  const text = document.createElement("span");
  text.textContent = "Loading recommendations\u2026";
  wrapper.appendChild(text);
  container.appendChild(wrapper);
}

function setEmpty(container, isColdStart) {
  container.innerHTML = "";
  const msg = document.createElement("div");
  msg.className = "status-message";
  msg.textContent = isColdStart
    ? "No popular games available right now."
    : "No recommendations available yet. Try favoriting some games!";
  container.appendChild(msg);
}

export async function initRecommendations(renderCardFn) {
  const section = document.getElementById("recommendations-section");
  if (!section) return;

  const heading = section.querySelector(".curated-section__title");
  const grid = section.querySelector(".curated-grid[data-grid='recommendations']");
  const refreshBtn = section.querySelector(".recommendations-refresh");

  if (!grid) return;

  // Check cache
  const cached = readCache();
  if (cached) {
    renderResults(grid, cached, heading, refreshBtn, renderCardFn);
    return;
  }

  setLoading(grid);

  const { profile, likedGameIds } = buildTasteProfile();
  const hasProfile = Object.keys(profile.genres).length > 0;

  try {
    const candidates = await getCandidateGames(profile, likedGameIds);
    const ranked = rankRecommendations(candidates, profile);
    const final = diversify(ranked);

    const isColdStart = !hasProfile;
    if (heading) {
      heading.textContent = isColdStart ? "Popular right now" : "Recommended for you";
    }

    if (final.length === 0) {
      // Fallback: fetch popular games for cold start
      if (isColdStart) {
        const fallback = await getCandidateGames({ genres: {}, tags: {} }, likedGameIds);
        const fallbackRanked = fallback.map(g => ({ game: g, score: g.rating || 0 }));
        const fallbackFinal = diversify(fallbackRanked);
        renderResults(grid, fallbackFinal, heading, refreshBtn, renderCardFn);
        writeCache(fallbackFinal);
      } else {
        setEmpty(grid, false);
        renderResults(grid, [], heading, refreshBtn, renderCardFn);
      }
      return;
    }

    renderResults(grid, final, heading, refreshBtn, renderCardFn);
    writeCache(final);
  } catch {
    setEmpty(grid, false);
  }
}

function renderResults(grid, results, heading, refreshBtn, renderCardFn) {
  grid.innerHTML = "";

  if (results.length === 0) {
    setEmpty(grid, heading && heading.textContent === "Popular right now");
    if (refreshBtn) refreshBtn.style.display = "none";
    return;
  }

  if (refreshBtn) {
    refreshBtn.style.display = "";
    refreshBtn.onclick = () => {
      clearCache();
      initRecommendations(renderCardFn);
    };
  }

  for (const { game } of results) {
    grid.appendChild(renderCardFn(game));
  }
}
