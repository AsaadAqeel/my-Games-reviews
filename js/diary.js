import { supabase } from "./supabase-client.js";
import { resolveUser } from "./user-resolver.js";

const dateEl    = document.getElementById("diary-date");
const listEl    = document.getElementById("diary-list");
const loadingEl = document.getElementById("diary-loading");

function formatDate(d) {
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatTime(dateStr) {
  const time = new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `Added at ${time}`;
}

function todayRange() {
  const now   = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function renderEntry(game) {
  const a = document.createElement("a");
  a.href = `game.html?id=${game.game_id}`;
  a.className = "diary-entry";

  const imgSrc = game.game_image || "";
  const imgHtml = imgSrc
    ? `<img class="diary-entry__thumb" src="${imgSrc}" alt="" onerror="this.style.display='none'" />`
    : `<div class="diary-entry__thumb diary-entry__thumb--fallback"></div>`;

  a.innerHTML = `
    ${imgHtml}
    <div class="diary-entry__info">
      <div class="diary-entry__title">${game.game_name || "Unknown Game"}</div>
      <div class="diary-entry__time">${formatTime(game.created_at)}</div>
    </div>`;
  return a;
}

function renderEmpty() {
  listEl.innerHTML = "";
  const p = document.createElement("p");
  p.className = "diary-empty";
  p.textContent = "No entries for today.";
  listEl.appendChild(p);
}

function renderError(msg) {
  listEl.innerHTML = "";
  const p = document.createElement("p");
  p.className = "diary-error";
  p.textContent = msg;
  listEl.appendChild(p);
}

async function loadDiary() {
  try {
    const profile = await resolveUser();
    if (!profile) {
      loadingEl.remove();
      console.warn("Diary: user not found");
      return;
    }

    dateEl.textContent = formatDate(new Date());

    const { start, end } = todayRange();

    const { data, error } = await supabase
      .from("played_games")
      .select("game_id, game_name, game_image, created_at")
      .eq("user_id", profile.id)
      .gte("created_at", start)
      .lt("created_at", end)
      .order("created_at", { ascending: false });

    loadingEl.remove();

    if (error) throw error;

    if (!data || data.length === 0) {
      renderEmpty();
      return;
    }

    listEl.innerHTML = "";
    data.forEach((game) => listEl.appendChild(renderEntry(game)));

  } catch (err) {
    loadingEl.remove();
    console.error("Failed to load diary:", err.message);
    renderError("Something went wrong loading your diary. Please try again later.");
  }
}

loadDiary();
