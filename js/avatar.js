import { supabase } from "./supabase-client.js";

/**
 * Render the nav avatar for the currently signed-in user.
 * Call this after auth state resolves. It reads the user's profile
 * and replaces the .auth-user-badge__avatar span contents.
 */
export async function renderNavAvatar() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, avatar_updated_at")
    .eq("id", user.id)
    .single();

  if (!profile) return;

  const badgeAvatar = document.querySelector(".auth-user-badge__avatar");
  if (!badgeAvatar) return;

  const username = profile.username || "User";
  const initial = username.charAt(0).toUpperCase();

  if (profile.avatar_url) {
    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(profile.avatar_url);
    const cacheBuster = profile.avatar_updated_at
      ? `?v=${new Date(profile.avatar_updated_at).getTime()}`
      : `?v=${Date.now()}`;

    badgeAvatar.innerHTML = "";
    const img = document.createElement("img");
    img.src = data.publicUrl + cacheBuster;
    img.alt = `${username}'s profile picture`;
    img.className = "auth-user-badge__avatar-img";
    img.loading = "lazy";
    img.onerror = () => {
      badgeAvatar.innerHTML = "";
      const fallback = document.createElement("span");
      fallback.className = "auth-user-badge__avatar-fallback";
      fallback.textContent = initial;
      badgeAvatar.appendChild(fallback);
    };
    badgeAvatar.appendChild(img);
  } else {
    badgeAvatar.innerHTML = "";
    const fallback = document.createElement("span");
    fallback.className = "auth-user-badge__avatar-fallback";
    fallback.textContent = initial;
    badgeAvatar.appendChild(fallback);
  }
}

/**
 * Listen for auth changes and render the nav avatar when a user signs in.
 * Import this from every page that shows the nav.
 */
export function initAvatar() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      renderNavAvatar();
    } else {
      const badgeAvatar = document.querySelector(".auth-user-badge__avatar");
      if (badgeAvatar) badgeAvatar.innerHTML = "";
    }
  });
}

/**
 * Get the current user's profile data.
 * Returns { user, profile } or { user: null, profile: null }.
 */
export async function getUserProfile() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { user: null, profile: null };

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_url, avatar_updated_at")
    .eq("id", user.id)
    .single();

  return { user, profile };
}

/**
 * Render an avatar (image or initials fallback) into a container element.
 * @param {HTMLElement} container
 * @param {object} profile - { username, avatar_url, avatar_updated_at }
 * @param {object} [opts] - { size: 96 }
 */
export function renderAvatar(container, profile, opts = {}) {
  if (!container) return;
  const size = opts.size || 96;
  const username = profile?.username || "User";
  const initial = username.charAt(0).toUpperCase();

  if (profile?.avatar_url) {
    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(profile.avatar_url);
    const cacheBuster = profile.avatar_updated_at
      ? `?v=${new Date(profile.avatar_updated_at).getTime()}`
      : `?v=${Date.now()}`;

    container.innerHTML = "";
    const img = document.createElement("img");
    img.src = data.publicUrl + cacheBuster;
    img.alt = `${username}'s profile picture`;
    img.className = "avatar-preview__img";
    img.style.width = size + "px";
    img.style.height = size + "px";
    img.onerror = () => {
      container.innerHTML = "";
      const fb = document.createElement("span");
      fb.className = "avatar-preview__fallback";
      fb.textContent = initial;
      container.appendChild(fb);
    };
    container.appendChild(img);
  } else {
    container.innerHTML = "";
    const fb = document.createElement("span");
    fb.className = "avatar-preview__fallback";
    fb.textContent = initial;
    container.appendChild(fb);
  }
}
