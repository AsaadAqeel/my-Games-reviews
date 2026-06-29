import { supabase } from "./supabase-client.js";
import { getGameDetail } from "./rawg.js";
import { resolveUser } from "./user-resolver.js";

const container = document.getElementById("lists-container");
const gameCache = new Map();
let selectedListId = null;

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
  const p = document.createElement("div");
  p.className = "status-message";
  p.textContent = msg;
  container.appendChild(p);
}

async function render() {
  const profile = await resolveUser();
  if (!profile) {
    container.innerHTML = "";
    renderEmpty("User not found.");
    return;
  }

  const { data: lists, error } = await supabase
    .from("lists")
    .select("*")
    .eq("user_id", profile.id)
    .order("created_at", { ascending: false });

  container.innerHTML = "";

  if (error) {
    console.error("Failed to load lists:", error.message);
    renderEmpty("Failed to load lists.");
    return;
  }

  const allLists = lists || [];

  if (allLists.length === 0) {
    renderEmpty("No lists yet.");
    return;
  }

  for (const list of allLists) {
    const { data: entries } = await supabase
      .from("list_entries")
      .select("*")
      .eq("list_id", list.id)
      .order("created_at", { ascending: false });

    const games = entries || [];
    const gameIds = games.map(g => g.game_id);
    const details = gameIds.length > 0 ? await fetchGameDetails(gameIds) : {};

    const card = document.createElement("div");
    card.className = "list-card";

    const header = document.createElement("div");
    header.className = "list-card__header";

    const titleBtn = document.createElement("button");
    titleBtn.type = "button";
    titleBtn.className = "list-card__title";
    titleBtn.textContent = list.list_name + " (" + games.length + ")";
    titleBtn.setAttribute("aria-expanded", selectedListId === list.id ? "true" : "false");
    titleBtn.addEventListener("click", () => {
      selectedListId = selectedListId === list.id ? null : list.id;
      render();
    });
    header.appendChild(titleBtn);
    card.appendChild(header);

    if (selectedListId === list.id && games.length > 0) {
      const grid = document.createElement("div");
      grid.className = "game-grid";

      for (const entry of games) {
        const g = details[entry.game_id] || {};
        const gameCard = document.createElement("div");
        gameCard.className = "game-card";

        const link = document.createElement("a");
        link.href = "game.html?id=" + entry.game_id;

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
        link.appendChild(body);

        gameCard.appendChild(link);
        grid.appendChild(gameCard);
      }

      card.appendChild(grid);
    }

    container.appendChild(card);
  }
}

render();
