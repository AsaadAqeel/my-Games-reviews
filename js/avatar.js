import { supabase } from "./supabase-client.js";

/**
 * Build a Supabase Storage public URL for an avatar path, with cache-busting.
 */
function avatarPublicUrl(avatarUrl, avatarUpdatedAt) {
  const { data } = supabase.storage.from("avatars").getPublicUrl(avatarUrl);
  const v = avatarUpdatedAt
    ? new Date(avatarUpdatedAt).getTime()
    : Date.now();
  return `${data.publicUrl}?v=${v}`;
}

/**
 * Create an <img> element styled as a circle.
 */
function createAvatarImg(src, alt, size) {
  const img = document.createElement("img");
  img.src = src;
  img.alt = alt;
  img.loading = "lazy";
  img.style.width = size + "px";
  img.style.height = size + "px";
  img.style.borderRadius = "50%";
  img.style.objectFit = "cover";
  img.style.display = "block";
  return img;
}

/**
 * Create an initials-fallback element styled as a circle.
 */
function createFallback(initial, size) {
  const fb = document.createElement("span");
  fb.textContent = initial;
  fb.style.display = "flex";
  fb.style.alignItems = "center";
  fb.style.justifyContent = "center";
  fb.style.width = size + "px";
  fb.style.height = size + "px";
  fb.style.borderRadius = "50%";
  fb.style.background = "var(--accent)";
  fb.style.color = "var(--accent-contrast)";
  fb.style.fontSize = Math.round(size * 0.4) + "px";
  fb.style.fontWeight = "700";
  fb.style.lineHeight = "1";
  fb.style.userSelect = "none";
  fb.style.flexShrink = "0";
  return fb;
}

/**
 * Render an avatar (image or initials fallback) into a container element.
 * Works for nav badge, profile page, review cards — any context.
 *
 * @param {HTMLElement} targetEl - Container to render into (will be cleared first)
 * @param {object} profile - { username, avatar_url, avatar_updated_at }
 * @param {object} [opts] - { size: 96 }
 */
export function renderAvatar(targetEl, profile, opts = {}) {
  if (!targetEl) return;
  const size = opts.size || 96;
  const username = profile?.username || "User";
  const initial = username.charAt(0).toUpperCase();

  // Clear target so fallback never stacks behind a broken image
  targetEl.innerHTML = "";

  if (profile?.avatar_url) {
    const src = avatarPublicUrl(profile.avatar_url, profile.avatar_updated_at);
    const alt = `${username}'s profile picture`;
    const img = createAvatarImg(src, alt, size);

    img.onerror = () => {
      targetEl.innerHTML = "";
      targetEl.appendChild(createFallback(initial, size));
    };

    targetEl.appendChild(img);
  } else {
    targetEl.appendChild(createFallback(initial, size));
  }
}

/**
 * Render the nav avatar for the currently signed-in user.
 * Uses the generic renderAvatar against the .auth-user-badge__avatar element.
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

  renderAvatar(badgeAvatar, profile, { size: 30 });
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
