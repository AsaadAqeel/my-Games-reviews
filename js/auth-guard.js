import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://dcdcuzfvnafvqazbjcor.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Dc7d2wJF_UK_n6qtz_uUvw_FnYb5s_W";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

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
    } else {
      userBadge.style.display = "none";
      const dropdown = userBadge.querySelector(".profile-dropdown");
      if (dropdown) dropdown.classList.remove("show");
    }
    console.log("[auth-guard] badge display:", userBadge.style.display, "user:", user?.email);
  }
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

    console.log("[auth-guard] profiles query result:", { data, error });

    nameEl.textContent = (error || !data?.username) ? "User" : data.username;
    console.log("[auth-guard] header display name set to:", nameEl.textContent);
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
}

// ===================== INIT =====================

async function initAuthGuard() {
  document.querySelectorAll("[data-auth-signout]").forEach(btn => {
    btn.addEventListener("click", handleSignOut);
  });

  // Profile dropdown toggle
  const triggerBtn = document.querySelector(".auth-user-badge__trigger");
  const dropdown = document.querySelector(".profile-dropdown");
  console.log("[auth-guard] dropdown init:", { triggerBtn, dropdown });
  if (triggerBtn && dropdown) {
    triggerBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isOpen = dropdown.classList.toggle("show");
      triggerBtn.setAttribute("aria-expanded", String(isOpen));
      console.log("[auth-guard] dropdown toggled:", isOpen);
    });

    // Close dropdown when clicking outside
    window.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && !triggerBtn.contains(e.target)) {
        dropdown.classList.remove("show");
        triggerBtn.setAttribute("aria-expanded", "false");
      }
    });

    // Close dropdown on Escape key
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        dropdown.classList.remove("show");
        triggerBtn.setAttribute("aria-expanded", "false");
      }
    });
  }

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
