import { supabase } from "./supabase-client.js";

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
  return new Date(dateStr).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function todayRange() {
  const now  = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const end   = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

function renderEntry(game) {
  const a = document.createElement("a");
  a.href = `game.html?id=${game.game_id}`;
  a.className = "diary-entry";
  a.innerHTML = `
    <img class="diary-entry__thumb"
         src="${game.background_image || ""}"
         alt=""
         onerror="this.style.display='none'" />
    <div class="diary-entry__info">
      <div class="diary-entry__title">${game.name || "Unknown game"}</div>
      <div class="diary-entry__time">${formatTime(game.created_at)}</div>
    </div>
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24"
         fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"
         stroke-linejoin="round" aria-hidden="true"
         style="flex-shrink:0;color:var(--text-muted)">
      <path d="M9 18l6-6-6-6"/>
    </svg>`;
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
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      loadingEl.remove();
      console.warn("Diary: not signed in");
      return;
    }

    dateEl.textContent = formatDate(new Date());

    const { start, end } = todayRange();

    const { data, error } = await supabase
      .from("played_games")
      .select("game_id, name, background_image, created_at")
      .eq("user_id", user.id)
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
