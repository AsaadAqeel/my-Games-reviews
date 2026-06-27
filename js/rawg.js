import { RAWG_API_KEY, RAWG_BASE_URL } from "./config.js";

function buildUrl(path, params = {}) {
  const url = new URL(`${RAWG_BASE_URL}${path}`);
  url.searchParams.set("key", RAWG_API_KEY);
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== "") {
      url.searchParams.set(k, v);
    }
  }
  return url.toString();
}

async function apiFetch(path, params = {}) {
  const { _signal, ...queryParams } = params;
  const url = buildUrl(path, queryParams);
  try {
    const res = await fetch(url, _signal ? { signal: _signal } : undefined);
    if (res.status === 401 || res.status === 403) {
      throw { type: "auth", message: "Invalid API key \u2014 please check your RAWG API key in config.js." };
    }
    if (res.status === 429) {
      throw { type: "rate", message: "Rate limit exceeded. Please wait a moment and try again." };
    }
    if (!res.ok) {
      throw { type: "network", message: `API error: ${res.status} ${res.statusText}` };
    }
    return await res.json();
  } catch (err) {
    if (err.name === "AbortError") throw err;
    if (err.type) throw err;
    throw { type: "network", message: "Network error. Please check your connection and try again." };
  }
}

export async function searchGames({ search = "", page = 1, pageSize = 20, genres = "", platforms = "", ordering = "", signal } = {}) {
  const params = {
    search,
    page,
    page_size: pageSize,
    genres,
    platforms,
    ordering,
    _signal: signal
  };

  if (search) {
    params.search_precise = true;
    params.search_exact = false;
  }

  return apiFetch("/games", params);
}

export async function getGameDetail(id) {
  return apiFetch(`/games/${id}`);
}

export async function getGameScreenshots(id) {
  return apiFetch(`/games/${id}/screenshots`);
}

export async function getGenres() {
  return apiFetch("/genres", { page_size: 50 });
}

export async function getPlatforms() {
  return apiFetch("/platforms", { page_size: 50 });
}
