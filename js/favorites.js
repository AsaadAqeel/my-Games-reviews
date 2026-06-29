import { supabase } from "./supabase-client.js";
import { getGameDetail } from "./rawg.js";
import { resolveUser } from "./user-resolver.js";

const gridEl = document.getElementById("favorites-grid");
const gameCache = new Map();

async function fetchGameDetails(ids) {
  const missing = ids.filter(id => !gameCache.has(Number(id)));
  if (missing.length > 0) {
    await Promise.allSettled(
      missing.map(id => getGameDetail(id).then(g => gameCache.set(Number(id), g)))
    );
  }
  const out = {};
  for (const id of ids) {
    out[id] = gameCache.get(Number(id)) || null;
  }
  return out;
}

function renderEmpty(msg) {
  gridEl.innerHTML = "";
  const p = document.createElement("div");
  p.className = "status-message";
  p.textContent = msg;
  gridEl.appendChild(p);
}

function renderCard(fav, details) {
  const g = details[fav.game_id] || {};
  const card = document.createElement("div");
  card.className = "game-card";

  const link = document.createElement("a");
  link.href = "game.html?id=" + fav.game_id;
  link.setAttribute("aria-label", "View details for " + (g.name || "Game"));

  const img = document.createElement("img");
  img.className = "game-card__image";
  img.src = g.background_image || "";
  img.alt = g.name || "Game";
  img.loading = "lazy";
  img.onerror = function() { this.classList.add("img-error"); this.style.display = "none"; };
  img.onload = function() { this.classList.add("img-loaded"); };
  if (img.complete && img.naturalWidth > 0) img.classList.add("img-loaded");
  link.appendChild(img);

  const body = document.createElement("div");
  body.className = "game-card__body";

  const title = document.createElement("div");
  title.className = "game-card__title";
  title.textContent = g.name || "Game";
  body.appendChild(title);

  const info = document.createElement("div");
  info.className = "game-card__genres";
  if (g.released) info.textContent = "Released: " + g.released;
  body.appendChild(info);

  const scores = document.createElement("div");
  scores.className = "game-card__scores";
  const rawgScore = document.createElement("span");
  rawgScore.className = "game-card__rawg-score";
  rawgScore.textContent = "RAWG: " + (g.rating != null ? g.rating.toFixed(1) : "N/A");
  scores.appendChild(rawgScore);
  body.appendChild(scores);

  link.appendChild(body);
  card.appendChild(link);

  return card;
}

async function render() {
  const profile = await resolveUser();
  if (!profile) {
    renderEmpty("User not found.");
    return;
  }

  const { data, error } = await supabase
    .from("favorites")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load favorites:", error.message);
    renderEmpty("Failed to load favorites.");
    return;
  }

  const favorites = data || [];
  gridEl.innerHTML = "";

  if (favorites.length === 0) {
    renderEmpty("No favorites yet \u2014 tap the star on any game.");
    return;
  }

  const gameIds = favorites.map(f => f.game_id);
  const details = await fetchGameDetails(gameIds);

  for (const fav of favorites) {
    gridEl.appendChild(renderCard(fav, details));
  }
}

render();
