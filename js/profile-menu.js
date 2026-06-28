// profile-menu.js — standalone dropdown toggle for .auth-user-badge
// Zero imports. No Supabase, no auth dependency. Plain script, not module.
(function () {
  if (window.__profileMenuInit) return;
  window.__profileMenuInit = true;

  var TRIGGER_SEL = ".auth-user-badge__trigger";
  var DROPDOWN_SEL = ".profile-dropdown";
  var ITEM_SEL = ".profile-dropdown__item";

  function closeAll() {
    document.querySelectorAll(DROPDOWN_SEL).forEach(function (dd) {
      dd.classList.remove("show");
    });
    document.querySelectorAll(TRIGGER_SEL).forEach(function (btn) {
      btn.setAttribute("aria-expanded", "false");
    });
  }

  // Event delegation on document — works even when the badge is hidden
  // initially and shown later by auth-guard.js.
  document.addEventListener("click", function (e) {
    // Toggle: click on the trigger button
    var trigger = e.target.closest(TRIGGER_SEL);
    if (trigger) {
      e.stopPropagation();
      var dd = trigger.parentElement.querySelector(DROPDOWN_SEL);
      if (!dd) return;
      var isOpen = dd.classList.toggle("show");
      trigger.setAttribute("aria-expanded", String(isOpen));
      return;
    }

    // Close: click on any dropdown item (link or sign-out button)
    var item = e.target.closest(ITEM_SEL);
    if (item) {
      closeAll();
      return;
    }

    // Close: click anywhere outside the badge
    var badge = e.target.closest("#auth-user-badge");
    if (!badge) {
      closeAll();
    }
  });

  // Close on Escape
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeAll();
  });
})();
