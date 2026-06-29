import { supabase } from "./supabase-client.js";
import { renderNavAvatar } from "./avatar.js";

let currentUser = null;
const authListeners = [];

// ===================== AUTH STATE SUBSCRIPTION =====================

/**
 * Subscribe to auth state changes. Called with (user | null) on every change.
 * Returns an unsubscribe function.
 */
export function onAuthChange(fn) {
  authListeners.push(fn);
  return () => {
    const idx = authListeners.indexOf(fn);
    if (idx !== -1) authListeners.splice(idx, 1);
  };
}

function notifyAuthListeners(user) {
  for (const fn of authListeners) fn(user);
}

// ===================== UI TOGGLE =====================

function applyAuthUI(user) {
  currentUser = user;

  // Toggle elements with data-auth="guest" (visible only when logged out)
  document.querySelectorAll("[data-auth='guest']").forEach(el => {
    el.style.display = user ? "none" : "";
  });

  // Toggle elements with data-auth="user" (visible only when logged in)
  document.querySelectorAll("[data-auth='user']").forEach(el => {
    el.style.display = user ? "" : "none";
  });

  // Update header auth area
  const signUpLink = document.querySelector(".main-nav__auth");
  const userBadge = document.getElementById("auth-user-badge");

  if (signUpLink) {
    signUpLink.style.display = user ? "none" : "";
  }

  if (userBadge) {
    if (user) {
      userBadge.style.display = "flex";
      loadProfileUsername(user);
      renderNavAvatar();
    } else {
      userBadge.style.display = "none";
      const dropdown = userBadge.querySelector(".profile-dropdown");
      if (dropdown) dropdown.classList.remove("show");
      const badgeAvatar = userBadge.querySelector(".auth-user-badge__avatar");
      if (badgeAvatar) badgeAvatar.innerHTML = "";
    }
  }

  // Notify subscribers (app.js uses this to clear UI on logout)
  notifyAuthListeners(user);
}

// ===================== PROFILE USERNAME =====================

async function loadProfileUsername(user) {
  const nameEl = document.querySelector(".profile-name-display");
  if (!nameEl) return;

  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    nameEl.textContent = (error || !data?.username) ? "User" : data.username;
  } catch (err) {
    console.error("[auth-guard] loadProfileUsername failed:", err);
    nameEl.textContent = "User";
  }
}

// ===================== ENSURE AUTH =====================

/**
 * Call this from any page that requires authentication.
 * Returns the current user if logged in, or null if not.
 * When not logged in, shows a sign-in prompt overlay.
 */
export async function ensureAuth() {
  if (currentUser) return currentUser;

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    return currentUser;
  }

  showSignInPrompt();
  return null;
}

function showSignInPrompt() {
  if (document.getElementById("auth-signin-prompt")) return;

  const overlay = document.createElement("div");
  overlay.id = "auth-signin-prompt";
  overlay.innerHTML = `
    <div class="signin-prompt__card">
      <p class="signin-prompt__text">Please sign in to continue</p>
      <div class="signin-prompt__actions">
        <a href="auth.html" class="signin-prompt__btn signin-prompt__btn--primary">Sign In</a>
        <button type="button" class="signin-prompt__btn signin-prompt__btn--dismiss" id="signin-prompt-dismiss">Maybe later</button>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById("signin-prompt-dismiss").addEventListener("click", () => {
    overlay.remove();
  });
}

// ===================== SIGN OUT =====================

async function handleSignOut() {
  await supabase.auth.signOut();
  currentUser = null;
}

// ===================== INIT =====================

async function initAuthGuard() {
  document.querySelectorAll("[data-auth-signout]").forEach(btn => {
    btn.addEventListener("click", handleSignOut);
  });

  // Check initial session
  const { data: { session } } = await supabase.auth.getSession();
  applyAuthUI(session?.user ?? null);

  // Listen for real-time auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    applyAuthUI(session?.user ?? null);
  });
}

// Run on DOM ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initAuthGuard);
} else {
  initAuthGuard();
}
