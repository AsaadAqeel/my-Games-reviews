import { supabase } from "./supabase-client.js";

const els = {
  username: document.getElementById("profile-username"),
  joined:   document.getElementById("profile-joined"),
  played:   document.getElementById("played-count"),
  favorite: document.getElementById("favorite-count"),
  lists:    document.getElementById("lists-count"),
  diary:    document.getElementById("diary-count"),
  reviews:  document.getElementById("reviews-count"),
};

function setText(el, value) {
  if (el) el.textContent = value;
}

function setStatLinks(profileId) {
  const links = {
    "played-link":   `played.html?user_id=${profileId}`,
    "favorite-link": `favorites.html?user_id=${profileId}`,
    "lists-link":    `lists.html?user_id=${profileId}`,
    "diary-link":    `diary.html?user_id=${profileId}`,
    "reviews-link":  `my-reviews.html?user_id=${profileId}`,
  };
  Object.keys(links).forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.href = links[id];
  });
}

function formatJoinDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d)) return "";
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  return `Joined ${month} ${year}`;
}

function avatarUrl(username) {
  return `https://api.dicebear.com/9.x/avataaars/svg?seed=${encodeURIComponent(username)}&backgroundColor=b6e3f4`;
}

async function countRows(table, userId) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;
  return count ?? 0;
}

async function getDiaryStats(userId) {
  const year = new Date().getFullYear();
  const yearStart = `${year}-01-01T00:00:00Z`;
  const yearEnd = `${year}-12-31T23:59:59Z`;

  const [total, yearCount] = await Promise.all([
    countRows("played_games", userId),
    supabase
      .from("played_games")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", yearStart)
      .lte("created_at", yearEnd)
      .then(({ count, error }) => {
        if (error) throw error;
        return count ?? 0;
      }),
  ]);

  return { total, year, yearCount };
}

async function loadProfile() {
  try {
    const urlParams = new URLSearchParams(window.location.search);
    const usernameParam = urlParams.get("username");

    let profile = null;

    if (usernameParam) {
      // Public profile: fetch by username
      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, created_at")
        .eq("username", usernameParam)
        .maybeSingle();

      if (error) throw error;
      profile = data;
    } else {
      // Own profile: fetch by auth user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        console.warn("Profile: not signed in");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("id, username, created_at")
        .eq("id", user.id)
        .maybeSingle();

      if (error) throw error;
      profile = data;
    }

    if (!profile) {
      setText(els.username, "User not found");
      return;
    }

    const name = profile.username || "User";
    setText(els.username, name);
    setText(els.joined, formatJoinDate(profile.created_at));
    setStatLinks(profile.id);

    const avatar = document.querySelector(".profile-avatar__img");
    if (avatar) avatar.src = avatarUrl(name);

    // Stat counts
    const [played, favorite, lists, reviews] = await Promise.all([
      countRows("played_games", profile.id),
      countRows("favorites",    profile.id),
      countRows("lists",        profile.id),
      countRows("reviews",      profile.id),
    ]);

    let diary = { total: 0, yearCount: 0 };
    try {
      diary = await getDiaryStats(profile.id);
    } catch (e) {
      console.warn("Diary stats failed:", e.message);
    }

    setText(els.played,   played);
    setText(els.favorite, favorite);
    setText(els.lists,    lists);
    setText(els.reviews,  reviews);
    setText(els.diary,    `${diary.total} / ${diary.yearCount} this year`);

  } catch (err) {
    console.error("Failed to load profile:", err.message);
  }
}

loadProfile();
