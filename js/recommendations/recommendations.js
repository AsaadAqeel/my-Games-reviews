// Depends on:
//   js/userDataManager.js            (syncAll for Supabase data)
//   js/recommendations/tasteProfile.js  (buildTasteProfile, watchTasteProfile)
//   js/recommendations/candidates.js    (getCandidateGames)
//   js/recommendations/score.js         (rankRecommendations)
//   js/recommendations/diversify.js     (diversify)
//   renderCuratedCard from js/app.js    (existing card component)
//   js/config.js                        (RAWG_API_KEY, RAWG_BASE_URL)

import { syncAll } from "../userDataManager.js";
import { buildTasteProfile, watchTasteProfile } from "./tasteProfile.js";
import { getCandidateGames } from "./candidates.js";
import { rankRecommendations } from "./score.js";
import { diversify } from "./diversify.js";

const CACHE_KEY = "recommendationsCache";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function getDataHash(data) {
  try {
    let hash = 0;
    const str = JSON.stringify(data.favoritesData || []) +
                JSON.stringify(data.playedData || []) +
                JSON.stringify(data.reviewsData || []);
    for (let i = 0; i < str.length; i++) {
      hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
    }
    return hash;
  } catch {
    return 0;
  }
}

function readCache(hash) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached = JSON.parse(raw);
    if (!cached || !cached.timestamp) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL) return null;
    if (cached.hash !== hash) return null;
    return cached.data;
  } catch {
    return null;
  }
}

function writeCache(data, hash) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      hash,
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

async function generateRecommendations(renderCardFn) {
  const section = document.getElementById("recommendations-section");
  if (!section) return;

  const heading = section.querySelector(".curated-section__title");
  const grid = section.querySelector(".curated-grid[data-grid='recommendations']");
  const refreshBtn = section.querySelector(".recommendations-refresh");

  if (!grid) return;

  setLoading(grid);

  const data = await syncAll();
  const { profile, likedGameIds } = buildTasteProfile(data);
  const hasProfile = Object.keys(profile.genres).length > 0;

  const dataHash = getDataHash(data);
  const cached = readCache(dataHash);

  if (cached) {
    renderResults(grid, cached, heading, refreshBtn, renderCardFn);
    // Set up reactive watcher for future changes
    watchTasteProfile(async (newResult) => {
      const newData = await syncAll();
      const newHash = getDataHash(newData);
      const newCached = readCache(newHash);
      if (newCached) {
        renderResults(grid, newCached, heading, refreshBtn, renderCardFn);
      } else {
        await refreshRecommendations(grid, heading, refreshBtn, renderCardFn, newData, newResult);
      }
    }, syncAll);
    return;
  }

  try {
    const candidates = await getCandidateGames(profile, likedGameIds);
    const ranked = rankRecommendations(candidates, profile);
    const final = diversify(ranked);

    if (heading) {
      heading.textContent = "Recommended for you";
    }

    if (final.length === 0) {
      if (isColdStart) {
        const fallback = await getCandidateGames({ genres: {}, tags: {} }, likedGameIds);
        const fallbackRanked = fallback.map(g => ({ game: g, score: g.rating || 0 }));
        const fallbackFinal = diversify(fallbackRanked);
        renderResults(grid, fallbackFinal, heading, refreshBtn, renderCardFn);
        writeCache(fallbackFinal, dataHash);
      } else {
        setEmpty(grid, false);
        renderResults(grid, [], heading, refreshBtn, renderCardFn);
      }
    } else {
      renderResults(grid, final, heading, refreshBtn, renderCardFn);
      writeCache(final, dataHash);
    }
  } catch {
    setEmpty(grid, false);
  }

  // Set up reactive watcher for future changes
  watchTasteProfile(async (newResult) => {
    const newData = await syncAll();
    const newHash = getDataHash(newData);
    const newCached = readCache(newHash);
    if (newCached) {
      renderResults(grid, newCached, heading, refreshBtn, renderCardFn);
    } else {
      await refreshRecommendations(grid, heading, refreshBtn, renderCardFn, newData, newResult);
    }
  }, syncAll);
}

async function refreshRecommendations(grid, heading, refreshBtn, renderCardFn, data, profileResult) {
  setLoading(grid);
  try {
    const { profile, likedGameIds } = profileResult || buildTasteProfile(data);
    const hasProfile = Object.keys(profile.genres).length > 0;
    const candidates = await getCandidateGames(profile, likedGameIds);
    const ranked = rankRecommendations(candidates, profile);
    const final = diversify(ranked);

    if (heading) {
      heading.textContent = "Recommended for you";
    }

    const dataHash = getDataHash(data);
    if (final.length > 0) {
      renderResults(grid, final, heading, refreshBtn, renderCardFn);
      writeCache(final, dataHash);
    } else if (hasProfile) {
      setEmpty(grid, false);
      renderResults(grid, [], heading, refreshBtn, renderCardFn);
    } else {
      const fallback = await getCandidateGames({ genres: {}, tags: {} }, likedGameIds);
      const fallbackRanked = fallback.map(g => ({ game: g, score: g.rating || 0 }));
      const fallbackFinal = diversify(fallbackRanked);
      renderResults(grid, fallbackFinal, heading, refreshBtn, renderCardFn);
      writeCache(fallbackFinal, dataHash);
    }
  } catch {
    setEmpty(grid, false);
  }
}

export async function initRecommendations(renderCardFn) {
  await generateRecommendations(renderCardFn);
}

function renderResults(grid, results, heading, refreshBtn, renderCardFn) {
  grid.innerHTML = "";

  if (results.length === 0) {
    setEmpty(grid, false);
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
