import { searchGames, getGameDetail, getGameScreenshots, getGenres, getPlatforms } from "./rawg.js";
import { getReviews, addReview, deleteReview, getAllUserReviews, getAverageRating, getReviewCount, getAllAverages, getPlayedGames, isPlayed, togglePlayed, removePlayed, getLists, createList, renameList, deleteList, addGameToList, removeGameFromList, isGameInList, getFavorites, isFavorite, toggleFavorite, removeFavorite } from "./storage.js";

// ===================== UTILITIES =====================

function formatDate(ts) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric", month: "short", day: "numeric"
  });
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function isCatalogPage() {
  return window.location.pathname.endsWith("index.html") ||
         window.location.pathname.endsWith("/") ||
         window.location.pathname === "";
}

// ===================== STAR WIDGET =====================

function createStarWidget(container, { value = 0, onChange, readonly = false, size = "1.2rem" }) {
  container.innerHTML = "";
  container.setAttribute("role", "radiogroup");
  container.setAttribute("aria-label", "Star rating");

  let currentValue = value;

  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("button");
    star.type = "button";
    star.className = "star" + (i <= currentValue ? " filled" : "");
    star.textContent = "\u2605";
    star.setAttribute("role", "radio");
    star.setAttribute("aria-checked", i === currentValue ? "true" : "false");
    star.setAttribute("aria-label", i + " star" + (i > 1 ? "s" : ""));
    star.setAttribute("tabindex", i === currentValue || (currentValue === 0 && i === 1) ? "0" : "-1");
    star.style.fontSize = size;

    if (!readonly) {
      star.addEventListener("click", () => {
        currentValue = i;
        updateStars(container, currentValue);
        if (onChange) onChange(currentValue);
      });

      star.addEventListener("keydown", (e) => {
        let next = currentValue;
        if (e.key === "ArrowRight" || e.key === "ArrowUp") {
          e.preventDefault();
          next = Math.min(5, currentValue + 1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
          e.preventDefault();
          next = Math.max(1, currentValue - 1);
        } else if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          next = currentValue;
        } else if (e.key === "Home") {
          e.preventDefault();
          next = 1;
        } else if (e.key === "End") {
          e.preventDefault();
          next = 5;
        } else {
          return;
        }
        currentValue = next;
        updateStars(container, currentValue);
        if (onChange) onChange(currentValue);
      });

      star.addEventListener("mouseenter", () => {
        for (const s of container.querySelectorAll(".star")) {
          const si = parseInt(s.dataset.index);
          s.classList.toggle("hovered", si <= i);
        }
      });

      star.addEventListener("mouseleave", () => {
        for (const s of container.querySelectorAll(".star")) {
          s.classList.remove("hovered");
        }
      });
    }

    star.dataset.index = i;
    container.appendChild(star);
  }

  return {
    getValue: () => currentValue,
    setValue: (v) => {
      currentValue = v;
      updateStars(container, currentValue);
    }
  };
}

function updateStars(container, value) {
  const stars = container.querySelectorAll(".star");
  stars.forEach((s, idx) => {
    const i = idx + 1;
    s.classList.toggle("filled", i <= value);
    s.setAttribute("aria-checked", i === value ? "true" : "false");
    s.setAttribute("tabindex", i === value || (value === 0 && i === 1) ? "0" : "-1");
  });
}

function renderStaticStars(rating) {
  const el = document.createElement("span");
  el.className = "stars stars--static";
  el.setAttribute("aria-label", rating.toFixed(1) + " out of 5 stars");
  for (let i = 1; i <= 5; i++) {
    const star = document.createElement("span");
    star.className = "star" + (i <= Math.round(rating) ? " filled" : "");
    star.textContent = "\u2605";
    star.style.cursor = "default";
    el.appendChild(star);
  }
  return el;
}

// ===================== FAVORITE STAR =====================

const STAR_SVG = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>';

function createFavStar(gameId, snapshot, onToggle) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "fav-star";
  const fav = isFavorite(gameId);
  btn.innerHTML = STAR_SVG;
  btn.setAttribute("aria-pressed", String(fav));
  btn.setAttribute("aria-label", fav ? "Remove from favorites" : "Add to favorites");

  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    const isNowFav = toggleFavorite(gameId, snapshot);
    btn.setAttribute("aria-pressed", String(isNowFav));
    btn.setAttribute("aria-label", isNowFav ? "Remove from favorites" : "Add to favorites");
    if (onToggle) onToggle(isNowFav);
  });

  return btn;
}

// ===================== ERROR DISPLAY =====================

function showError(container, message) {
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = "status-message error";
  div.setAttribute("role", "alert");
  div.textContent = message;
  container.appendChild(div);
}

function showLoading(container) {
  container.innerHTML = '<div class="spinner"></div><p class="status-message">Loading...</p>';
}

function showEmpty(container, message) {
  container.innerHTML = "";
  const div = document.createElement("div");
  div.className = "status-message";
  div.textContent = message;
  container.appendChild(div);
}

// ===================== LIGHTBOX =====================

function createLightbox(images, startIndex = 0) {
  let currentIdx = startIndex;

  const overlay = document.createElement("div");
  overlay.className = "lightbox";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Screenshot viewer");
  overlay.setAttribute("aria-modal", "true");

  const img = document.createElement("img");
  img.src = images[currentIdx].image;
  img.alt = "Screenshot " + (currentIdx + 1);
  overlay.appendChild(img);

  const closeBtn = document.createElement("button");
  closeBtn.className = "lightbox__close";
  closeBtn.innerHTML = "&times;";
  closeBtn.setAttribute("aria-label", "Close viewer");
  overlay.appendChild(closeBtn);

  function update() {
    img.src = images[currentIdx].image;
    img.alt = "Screenshot " + (currentIdx + 1);
    prevBtn.style.display = images.length > 1 ? "flex" : "none";
    nextBtn.style.display = images.length > 1 ? "flex" : "none";
  }

  const prevBtn = document.createElement("button");
  prevBtn.className = "lightbox__nav lightbox__prev";
  prevBtn.innerHTML = "&#8249;";
  prevBtn.setAttribute("aria-label", "Previous screenshot");
  prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentIdx = (currentIdx - 1 + images.length) % images.length;
    update();
  });
  overlay.appendChild(prevBtn);

  const nextBtn = document.createElement("button");
  nextBtn.className = "lightbox__nav lightbox__next";
  nextBtn.innerHTML = "&#8250;";
  nextBtn.setAttribute("aria-label", "Next screenshot");
  nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentIdx = (currentIdx + 1) % images.length;
    update();
  });
  overlay.appendChild(nextBtn);

  function close() {
    document.removeEventListener("keydown", handleKey);
    overlay.remove();
  }

  function handleKey(e) {
    if (e.key === "Escape") close();
    if (e.key === "ArrowLeft") { currentIdx = (currentIdx - 1 + images.length) % images.length; update(); }
    if (e.key === "ArrowRight") { currentIdx = (currentIdx + 1) % images.length; update(); }
  }

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });

  document.addEventListener("keydown", handleKey);
  document.body.appendChild(overlay);
  closeBtn.focus();
}

// ===================== CATALOG PAGE =====================

async function initCatalog() {
  const gridEl = document.getElementById("game-grid");
  const statusEl = document.getElementById("status-message");
  const paginationEl = document.getElementById("pagination");
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");
  const genreFilter = document.getElementById("genre-filter");
  const platformFilter = document.getElementById("platform-filter");
  const sortSelect = document.getElementById("sort-select");

  let currentPage = 1;
  let currentSearch = getParam("search") || "";
  let currentGenre = "";
  let currentPlatform = "";
  let currentOrder = "-rating";
  let totalResults = 0;
  let userAverages = {};

  if (currentSearch) {
    searchInput.value = currentSearch;
  }

  // Load filter options
  try {
    const [genresData, platformsData] = await Promise.all([getGenres(), getPlatforms()]);
    for (const g of genresData.results || []) {
      const opt = document.createElement("option");
      opt.value = g.id;
      opt.textContent = g.name;
      genreFilter.appendChild(opt);
    }
    for (const p of platformsData.results || []) {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      platformFilter.appendChild(opt);
    }
  } catch {
    // Filters will remain with defaults
  }

  async function loadGames(page = 1) {
    currentPage = page;
    userAverages = getAllAverages();

    showLoading(gridEl);
    statusEl.innerHTML = "";
    paginationEl.innerHTML = "";

    try {
      const data = await searchGames({
        search: currentSearch,
        page: currentPage,
        pageSize: 20,
        genres: currentGenre,
        platforms: currentPlatform,
        ordering: currentOrder
      });

      totalResults = data.count || 0;

      if (!data.results || data.results.length === 0) {
        showEmpty(gridEl, "No games match your search.");
        return;
      }

      gridEl.innerHTML = "";

      for (const game of data.results) {
        const card = document.createElement("div");
        card.className = "game-card";

        const link = document.createElement("a");
        link.href = "game.html?id=" + game.id;
        link.setAttribute("aria-label", "View details for " + game.name);

        const img = document.createElement("img");
        img.className = "game-card__image";
        img.src = game.background_image || "";
        img.alt = game.name;
        img.loading = "lazy";
        img.onerror = function() { this.style.display = "none"; };
        link.appendChild(img);

        const body = document.createElement("div");
        body.className = "game-card__body";

        const title = document.createElement("div");
        title.className = "game-card__title";
        title.textContent = game.name;
        body.appendChild(title);

        const genres = document.createElement("div");
        genres.className = "game-card__genres";
        genres.textContent = (game.genres || []).map(g => g.name).join(", ") || "Unknown genre";
        body.appendChild(genres);

        const scores = document.createElement("div");
        scores.className = "game-card__scores";

        const rawgScore = document.createElement("span");
        rawgScore.className = "game-card__rawg-score";
        rawgScore.textContent = "RAWG: " + (game.rating != null ? game.rating.toFixed(1) : "N/A");
        scores.appendChild(rawgScore);

        const userScore = document.createElement("span");
        userScore.className = "game-card__user-score";
        const avg = userAverages[game.id];
        if (avg) {
          userScore.textContent = "\u2605 " + avg.average.toFixed(1) + " (" + avg.count + ")";
        } else {
          userScore.textContent = "No reviews";
          userScore.style.color = "var(--text-muted)";
        }
        scores.appendChild(userScore);

        body.appendChild(scores);
        link.appendChild(body);
        card.appendChild(link);

        const favSnapshot = {
          id: game.id,
          name: game.name,
          image: game.background_image || "",
          rating: game.rating,
          released: game.released
        };
        card.appendChild(createFavStar(game.id, favSnapshot));

        gridEl.appendChild(card);
      }

      renderPagination(data);
    } catch (err) {
      showError(gridEl, err.message || "An unexpected error occurred.");
    }
  }

  function renderPagination(data) {
    paginationEl.innerHTML = "";
    const totalPages = Math.ceil(totalResults / 20);

    if (totalPages <= 1) return;

    const prevBtn = document.createElement("button");
    prevBtn.textContent = "Previous";
    prevBtn.disabled = !data.previous;
    prevBtn.addEventListener("click", () => loadGames(currentPage - 1));
    paginationEl.appendChild(prevBtn);

    const info = document.createElement("span");
    info.style.padding = "0.5rem 1rem";
    info.style.color = "var(--text-muted)";
    info.textContent = "Page " + currentPage + " of " + totalPages;
    paginationEl.appendChild(info);

    const nextBtn = document.createElement("button");
    nextBtn.textContent = "Next";
    nextBtn.disabled = !data.next;
    nextBtn.addEventListener("click", () => loadGames(currentPage + 1));
    paginationEl.appendChild(nextBtn);
  }

  // Search
  const debouncedSearch = debounce(() => {
    currentSearch = searchInput.value.trim();
    loadGames(1);
  }, 400);

  searchInput.addEventListener("input", debouncedSearch);
  searchBtn.addEventListener("click", () => {
    currentSearch = searchInput.value.trim();
    loadGames(1);
  });
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      currentSearch = searchInput.value.trim();
      loadGames(1);
    }
  });

  // Filters
  genreFilter.addEventListener("change", () => {
    currentGenre = genreFilter.value;
    loadGames(1);
  });

  platformFilter.addEventListener("change", () => {
    currentPlatform = platformFilter.value;
    loadGames(1);
  });

  sortSelect.addEventListener("change", () => {
    currentOrder = sortSelect.value;
    loadGames(1);
  });

  // Initial load
  loadGames(1);
}

// ===================== GAME DETAIL PAGE =====================

async function initGameDetail() {
  const gameId = getParam("id");
  if (!gameId) {
    window.location.href = "index.html";
    return;
  }

  const loadingEl = document.getElementById("game-detail-loading");
  const errorEl = document.getElementById("game-detail-error");
  const detailEl = document.getElementById("game-detail");
  const reviewsEl = document.getElementById("reviews-section");

  let gameData = null;
  let screenshotsData = [];

  try {
    [gameData, screenshotsData] = await Promise.all([
      getGameDetail(gameId),
      getGameScreenshots(gameId)
    ]);
  } catch (err) {
    loadingEl.style.display = "none";
    showError(errorEl, err.message || "Failed to load game details.");
    errorEl.style.display = "block";
    return;
  }

  loadingEl.style.display = "none";
  detailEl.style.display = "block";
  reviewsEl.style.display = "block";

  document.title = gameData.name + " - GameVault";

  // Hero image
  const hero = document.createElement("div");
  hero.className = "game-hero";
  if (gameData.background_image) {
    const heroImg = document.createElement("img");
    heroImg.src = gameData.background_image;
    heroImg.alt = gameData.name;
    hero.appendChild(heroImg);
  }
  detailEl.appendChild(hero);

  // Back link
  const backLink = document.createElement("a");
  backLink.href = "index.html";
  backLink.className = "back-link";
  backLink.innerHTML = "&larr; Back to catalog";
  detailEl.appendChild(backLink);

  // Title
  const title = document.createElement("h1");
  title.className = "game-detail__title";
  title.textContent = gameData.name;
  detailEl.appendChild(title);

  // Meta
  const meta = document.createElement("div");
  meta.className = "game-detail__meta";

  if (gameData.released) {
    const rel = document.createElement("span");
    rel.textContent = "Released: " + gameData.released;
    meta.appendChild(rel);
  }
  if (gameData.developers && gameData.developers.length > 0) {
    const dev = document.createElement("span");
    dev.textContent = "Developer: " + gameData.developers.map(d => d.name).join(", ");
    meta.appendChild(dev);
  }
  if (gameData.genres && gameData.genres.length > 0) {
    const gen = document.createElement("span");
    gen.textContent = "Genres: " + gameData.genres.map(g => g.name).join(", ");
    meta.appendChild(gen);
  }
  if (gameData.platforms && gameData.platforms.length > 0) {
    const plat = document.createElement("span");
    plat.textContent = "Platforms: " + gameData.platforms.map(p => p.platform.name).join(", ");
    meta.appendChild(plat);
  }
  detailEl.appendChild(meta);

  // Scores
  const scoresContainer = document.createElement("div");
  scoresContainer.className = "game-detail__scores";

  // RAWG score
  const rawgBox = document.createElement("div");
  rawgBox.className = "score-box";
  const rawgLabel = document.createElement("div");
  rawgLabel.className = "score-box__label";
  rawgLabel.textContent = "RAWG Score";
  rawgBox.appendChild(rawgLabel);
  const rawgValue = document.createElement("div");
  rawgValue.className = "score-box__value rawg";
  rawgValue.textContent = gameData.rating != null ? gameData.rating.toFixed(1) : "N/A";
  rawgBox.appendChild(rawgValue);
  if (gameData.ratings_count) {
    const rawgCount = document.createElement("div");
    rawgCount.className = "score-box__count";
    rawgCount.textContent = gameData.ratings_count + " ratings on RAWG";
    rawgBox.appendChild(rawgCount);
  }
  scoresContainer.appendChild(rawgBox);

  // Metacritic score
  if (gameData.metacritic) {
    const mcBox = document.createElement("div");
    mcBox.className = "score-box";
    const mcLabel = document.createElement("div");
    mcLabel.className = "score-box__label";
    mcLabel.textContent = "Metacritic";
    mcBox.appendChild(mcLabel);
    const mcValue = document.createElement("div");
    mcValue.className = "score-box__value rawg";
    mcValue.textContent = gameData.metacritic;
    mcBox.appendChild(mcValue);
    scoresContainer.appendChild(mcBox);
  }

  // User score
  const userBox = document.createElement("div");
  userBox.className = "score-box";
  const userLabel = document.createElement("div");
  userLabel.className = "score-box__label";
  userLabel.textContent = "User Rating";
  userBox.appendChild(userLabel);
  const userValue = document.createElement("div");
  userValue.className = "score-box__value user";
  userValue.id = "user-score-value";
  const avg = getAverageRating(gameId);
  const count = getReviewCount(gameId);
  userValue.textContent = avg != null ? avg.toFixed(1) : "N/A";
  userBox.appendChild(userValue);
  const userCount = document.createElement("div");
  userCount.className = "score-box__count";
  userCount.id = "user-score-count";
  userCount.textContent = count + " on-site review" + (count !== 1 ? "s" : "");
  userBox.appendChild(userCount);
  scoresContainer.appendChild(userBox);

  detailEl.appendChild(scoresContainer);

  // Actions row
  const actionsRow = document.createElement("div");
  actionsRow.className = "game-detail__actions";

  const playedBtn = document.createElement("button");
  playedBtn.type = "button";
  playedBtn.className = "played-btn";
  playedBtn.setAttribute("aria-pressed", String(isPlayed(gameId)));

  function updatePlayedBtn() {
    const played = isPlayed(gameId);
    playedBtn.textContent = played ? "Played" : "Play";
    playedBtn.classList.toggle("played-btn--active", played);
    playedBtn.setAttribute("aria-pressed", String(played));
  }
  updatePlayedBtn();

  playedBtn.addEventListener("click", () => {
    togglePlayed(gameId, {
      id: gameData.id,
      name: gameData.name,
      image: gameData.background_image || "",
      rating: gameData.rating,
      released: gameData.released
    });
    updatePlayedBtn();
  });

  actionsRow.appendChild(playedBtn);

  // Favorite star on detail page
  const detailFavSnapshot = {
    id: gameData.id,
    name: gameData.name,
    image: gameData.background_image || "",
    rating: gameData.rating,
    released: gameData.released
  };
  actionsRow.appendChild(createFavStar(gameId, detailFavSnapshot));

  // "Add to List" dropdown
  const listDropdown = document.createElement("div");
  listDropdown.className = "list-dropdown";

  const listToggle = document.createElement("button");
  listToggle.type = "button";
  listToggle.className = "played-btn list-toggle";
  listToggle.textContent = "Add to List \u25BE";
  listDropdown.appendChild(listToggle);

  const listMenu = document.createElement("div");
  listMenu.className = "list-menu";
  listMenu.setAttribute("role", "menu");
  listMenu.style.display = "none";
  listDropdown.appendChild(listMenu);

  // PRIMARY DEFENSE: stop all clicks/mousedowns inside the menu from bubbling
  listMenu.addEventListener("click", function(e) { e.stopPropagation(); });
  listMenu.addEventListener("mousedown", function(e) { e.stopPropagation(); });

  function renderListMenu() {
    // Clear and rebuild the list rows + create input
    listMenu.innerHTML = "";
    var lists = getLists();

    lists.forEach(function(list) {
      var item = document.createElement("label");
      item.className = "list-menu__item";
      item.setAttribute("role", "menuitemcheckbox");

      var checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = isGameInList(list.id, gameId);
      checkbox.setAttribute("aria-label", list.name);

      var nameSpan = document.createElement("span");
      nameSpan.textContent = list.name;

      item.appendChild(checkbox);
      item.appendChild(nameSpan);

      checkbox.addEventListener("change", function() {
        var snapshot = {
          id: gameData.id,
          name: gameData.name,
          image: gameData.background_image || "",
          rating: gameData.rating,
          released: gameData.released
        };
        if (checkbox.checked) {
          addGameToList(list.id, snapshot);
        } else {
          removeGameFromList(list.id, gameId);
        }
      });

      listMenu.appendChild(item);
    });

    // Create new list input row
    var createRow = document.createElement("div");
    createRow.className = "list-menu__create";

    var createInput = document.createElement("input");
    createInput.type = "text";
    createInput.placeholder = "New list name...";
    createInput.maxLength = 40;
    createInput.setAttribute("aria-label", "New list name");

    var createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.className = "list-menu__create-btn";
    createBtn.textContent = "+";
    createBtn.setAttribute("aria-label", "Create list");

    function doCreate(e) {
      if (e) e.stopPropagation();
      var name = createInput.value.trim();
      if (!name) return;
      createList(name);
      createInput.value = "";
      renderListMenu();
    }

    createBtn.addEventListener("click", doCreate);
    createInput.addEventListener("keydown", function(e) {
      if (e.key === "Enter") {
        e.preventDefault();
        doCreate(e);
      }
    });

    createRow.appendChild(createInput);
    createRow.appendChild(createBtn);
    listMenu.appendChild(createRow);
  }

  function closeListMenu() {
    listMenu.style.display = "none";
    document.removeEventListener("click", handleOutsideClick);
    document.removeEventListener("keydown", handleEscapeKey);
    listToggle.focus();
  }

  // BACKUP GUARD: use closest() against live DOM, never a captured variable
  function handleOutsideClick(e) {
    if (e.target.closest(".list-menu") || e.target.closest(".list-toggle")) return;
    closeListMenu();
  }

  function handleEscapeKey(e) {
    if (e.key === "Escape") closeListMenu();
  }

  listToggle.addEventListener("click", function(e) {
    e.stopPropagation();
    var isOpen = listMenu.style.display !== "none";
    if (isOpen) {
      closeListMenu();
    } else {
      listMenu.style.display = "block";
      renderListMenu();
      document.addEventListener("click", handleOutsideClick);
      document.addEventListener("keydown", handleEscapeKey);
    }
  });

  actionsRow.appendChild(listDropdown);
  detailEl.appendChild(actionsRow);

  // Description
  if (gameData.description_raw) {
    const descSection = document.createElement("div");
    descSection.className = "game-description";
    const descTitle = document.createElement("h2");
    descTitle.textContent = "About this game";
    descSection.appendChild(descTitle);
    const descText = document.createElement("p");
    descText.textContent = gameData.description_raw;
    descSection.appendChild(descText);
    detailEl.appendChild(descSection);
  }

  // Screenshots
  const screenshots = screenshotsData.results || [];
  if (screenshots.length > 0) {
    const ssSection = document.createElement("div");
    ssSection.className = "screenshots";
    const ssTitle = document.createElement("h2");
    ssTitle.textContent = "Screenshots";
    ssSection.appendChild(ssTitle);

    const ssGrid = document.createElement("div");
    ssGrid.className = "screenshots__grid";

    screenshots.forEach((ss, idx) => {
      const ssImg = document.createElement("img");
      ssImg.src = ss.image;
      ssImg.alt = "Screenshot " + (idx + 1);
      ssImg.loading = "lazy";
      ssImg.addEventListener("click", () => createLightbox(screenshots, idx));
      ssGrid.appendChild(ssImg);
    });

    ssSection.appendChild(ssGrid);
    detailEl.appendChild(ssSection);
  }

  // Reviews
  renderReviewsSection(reviewsEl, gameId);
}

// ===================== REVIEWS SECTION =====================

function renderReviewsSection(container, gameId) {
  container.innerHTML = "";

  const heading = document.createElement("h2");
  heading.textContent = "User Reviews";
  container.appendChild(heading);

  // Review form
  const form = document.createElement("div");
  form.className = "review-form";

  const formTitle = document.createElement("h3");
  formTitle.textContent = "Write a Review";
  form.appendChild(formTitle);

  // Star rating
  const ratingGroup = document.createElement("div");
  ratingGroup.className = "form-group";
  const ratingLabel = document.createElement("label");
  ratingLabel.textContent = "Your Rating *";
  ratingGroup.appendChild(ratingLabel);
  const starContainer = document.createElement("div");
  starContainer.className = "stars";
  ratingGroup.appendChild(starContainer);
  const ratingError = document.createElement("div");
  ratingError.className = "form-error";
  ratingError.id = "rating-error";
  ratingGroup.appendChild(ratingError);
  form.appendChild(ratingGroup);

  let widget = createStarWidget(starContainer, { value: 0 });

  // Title
  const titleGroup = document.createElement("div");
  titleGroup.className = "form-group";
  const titleLabel = document.createElement("label");
  titleLabel.setAttribute("for", "review-title");
  titleLabel.textContent = "Review Title *";
  titleGroup.appendChild(titleLabel);
  const titleInput = document.createElement("input");
  titleInput.type = "text";
  titleInput.id = "review-title";
  titleInput.maxLength = 100;
  titleInput.placeholder = "Summarize your review";
  titleGroup.appendChild(titleInput);
  const titleError = document.createElement("div");
  titleError.className = "form-error";
  titleError.id = "title-error";
  titleGroup.appendChild(titleError);
  form.appendChild(titleGroup);

  // Body
  const bodyGroup = document.createElement("div");
  bodyGroup.className = "form-group";
  const bodyLabel = document.createElement("label");
  bodyLabel.setAttribute("for", "review-body");
  bodyLabel.textContent = "Your Review * (min 10 characters)";
  bodyGroup.appendChild(bodyLabel);
  const bodyInput = document.createElement("textarea");
  bodyInput.id = "review-body";
  bodyInput.minLength = 10;
  bodyInput.placeholder = "Share your thoughts about this game...";
  bodyGroup.appendChild(bodyInput);
  const bodyError = document.createElement("div");
  bodyError.className = "form-error";
  bodyError.id = "body-error";
  bodyGroup.appendChild(bodyError);
  form.appendChild(bodyGroup);

  // Name
  const nameGroup = document.createElement("div");
  nameGroup.className = "form-group";
  const nameLabel = document.createElement("label");
  nameLabel.setAttribute("for", "review-name");
  nameLabel.textContent = "Your Name (optional)";
  nameGroup.appendChild(nameLabel);
  const nameInput = document.createElement("input");
  nameInput.type = "text";
  nameInput.id = "review-name";
  nameInput.maxLength = 50;
  nameInput.placeholder = "Anonymous";
  nameGroup.appendChild(nameInput);
  form.appendChild(nameGroup);

  // Submit
  const submitBtn = document.createElement("button");
  submitBtn.type = "button";
  submitBtn.className = "submit-btn";
  submitBtn.textContent = "Submit Review";
  form.appendChild(submitBtn);

  submitBtn.addEventListener("click", () => {
    const rating = widget.getValue();
    const titleVal = titleInput.value.trim();
    const bodyVal = bodyInput.value.trim();
    const nameVal = nameInput.value.trim();

    let hasError = false;

    // Validate rating
    if (rating === 0) {
      ratingError.textContent = "Please select a star rating.";
      ratingError.classList.add("visible");
      hasError = true;
    } else {
      ratingError.classList.remove("visible");
    }

    // Validate title
    if (!titleVal) {
      titleError.textContent = "Please enter a review title.";
      titleError.classList.add("visible");
      hasError = true;
    } else {
      titleError.classList.remove("visible");
    }

    // Validate body
    if (bodyVal.length < 10) {
      bodyError.textContent = "Review must be at least 10 characters long.";
      bodyError.classList.add("visible");
      hasError = true;
    } else {
      bodyError.classList.remove("visible");
    }

    if (hasError) return;

    addReview(gameId, {
      rating,
      title: titleVal,
      body: bodyVal,
      name: nameVal || "Anonymous",
      gameName: gameData.name,
      gameImage: gameData.background_image || ""
    });

    // Reset form
    widget.setValue(0);
    titleInput.value = "";
    bodyInput.value = "";
    nameInput.value = "";

    // Re-render
    renderReviewsSection(container, gameId);
  });

  container.appendChild(form);

  // Reviews list
  const reviews = getReviews(gameId);

  if (reviews.length === 0) {
    const emptyMsg = document.createElement("div");
    emptyMsg.className = "status-message";
    emptyMsg.textContent = "No reviews yet \u2014 be the first!";
    container.appendChild(emptyMsg);
  } else {
    const listTitle = document.createElement("h3");
    listTitle.textContent = reviews.length + " Review" + (reviews.length !== 1 ? "s" : "");
    listTitle.style.marginBottom = "0.75rem";
    container.appendChild(listTitle);

    for (const review of reviews) {
      const card = document.createElement("div");
      card.className = "review-card";

      const header = document.createElement("div");
      header.className = "review-card__header";

      const author = document.createElement("span");
      author.className = "review-card__author";
      author.textContent = review.name;
      header.appendChild(author);

      const date = document.createElement("span");
      date.className = "review-card__date";
      date.textContent = formatDate(review.date);
      header.appendChild(date);

      card.appendChild(header);

      const starsEl = renderStaticStars(review.rating);
      card.appendChild(starsEl);

      const reviewTitle = document.createElement("div");
      reviewTitle.className = "review-card__title";
      reviewTitle.textContent = review.title;
      card.appendChild(reviewTitle);

      const body = document.createElement("div");
      body.className = "review-card__body";
      body.textContent = review.body;
      card.appendChild(body);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-review-btn";
      deleteBtn.textContent = "Delete My Review";
      deleteBtn.addEventListener("click", () => {
        if (confirm("Delete this review?")) {
          deleteReview(gameId, review.id);
          renderReviewsSection(container, gameId);
          const newAvg = getAverageRating(gameId);
          const newCount = getReviewCount(gameId);
          const scoreVal = document.getElementById("user-score-value");
          const scoreCnt = document.getElementById("user-score-count");
          if (scoreVal) scoreVal.textContent = newAvg != null ? newAvg.toFixed(1) : "N/A";
          if (scoreCnt) scoreCnt.textContent = newCount + " on-site review" + (newCount !== 1 ? "s" : "");
        }
      });
      card.appendChild(deleteBtn);

      container.appendChild(card);
    }
  }
}

// ===================== PLAYED PAGE =====================

function initPlayedPage() {
  const gridEl = document.getElementById("played-grid");
  const statusEl = document.getElementById("played-status");
  const sortSelect = document.getElementById("played-sort");

  let currentSort = "recent";

  function render() {
    let games = getPlayedGames();

    if (currentSort === "name") {
      games = [...games].sort((a, b) => a.name.localeCompare(b.name));
    }

    gridEl.innerHTML = "";

    if (games.length === 0) {
      showEmpty(gridEl, "You haven\u2019t marked any games as played yet.");
      return;
    }

    for (const game of games) {
      const card = document.createElement("div");
      card.className = "game-card";

      const link = document.createElement("a");
      link.href = "game.html?id=" + game.id;
      link.setAttribute("aria-label", "View details for " + game.name);

      const img = document.createElement("img");
      img.className = "game-card__image";
      img.src = game.image || "";
      img.alt = game.name;
      img.loading = "lazy";
      img.onerror = function() { this.style.display = "none"; };
      link.appendChild(img);

      const body = document.createElement("div");
      body.className = "game-card__body";

      const title = document.createElement("div");
      title.className = "game-card__title";
      title.textContent = game.name;
      body.appendChild(title);

      const info = document.createElement("div");
      info.className = "game-card__genres";
      if (game.released) {
        info.textContent = "Released: " + game.released;
      }
      body.appendChild(info);

      const scores = document.createElement("div");
      scores.className = "game-card__scores";

      const rawgScore = document.createElement("span");
      rawgScore.className = "game-card__rawg-score";
      rawgScore.textContent = "RAWG: " + (game.rating != null ? game.rating.toFixed(1) : "N/A");
      scores.appendChild(rawgScore);

      body.appendChild(scores);
      link.appendChild(body);
      card.appendChild(link);

      const removeBtn = document.createElement("button");
      removeBtn.type = "button";
      removeBtn.className = "remove-btn";
      removeBtn.textContent = "Remove";
      removeBtn.setAttribute("aria-label", "Remove " + game.name + " from played");
      removeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        removePlayed(game.id);
        render();
      });
      card.appendChild(removeBtn);

      const favSnapshot = {
        id: game.id,
        name: game.name,
        image: game.image || "",
        rating: game.rating,
        released: game.released
      };
      card.appendChild(createFavStar(game.id, favSnapshot));

      gridEl.appendChild(card);
    }
  }

  sortSelect.addEventListener("change", () => {
    currentSort = sortSelect.value;
    render();
  });

  render();
}

// ===================== FAVORITES PAGE =====================

function initFavoritesPage() {
  const gridEl = document.getElementById("favorites-grid");

  function render() {
    const games = getFavorites();
    gridEl.innerHTML = "";

    if (games.length === 0) {
      showEmpty(gridEl, "No favorites yet \u2014 tap the star on any game.");
      return;
    }

    for (const game of games) {
      const card = document.createElement("div");
      card.className = "game-card";

      const link = document.createElement("a");
      link.href = "game.html?id=" + game.id;
      link.setAttribute("aria-label", "View details for " + game.name);

      const img = document.createElement("img");
      img.className = "game-card__image";
      img.src = game.image || "";
      img.alt = game.name;
      img.loading = "lazy";
      img.onerror = function() { this.style.display = "none"; };
      link.appendChild(img);

      const body = document.createElement("div");
      body.className = "game-card__body";

      const title = document.createElement("div");
      title.className = "game-card__title";
      title.textContent = game.name;
      body.appendChild(title);

      const info = document.createElement("div");
      info.className = "game-card__genres";
      if (game.released) {
        info.textContent = "Released: " + game.released;
      }
      body.appendChild(info);

      const scores = document.createElement("div");
      scores.className = "game-card__scores";

      const rawgScore = document.createElement("span");
      rawgScore.className = "game-card__rawg-score";
      rawgScore.textContent = "RAWG: " + (game.rating != null ? game.rating.toFixed(1) : "N/A");
      scores.appendChild(rawgScore);

      body.appendChild(scores);
      link.appendChild(body);
      card.appendChild(link);

      const favSnapshot = {
        id: game.id,
        name: game.name,
        image: game.image || "",
        rating: game.rating,
        released: game.released
      };
      card.appendChild(createFavStar(game.id, favSnapshot, () => render()));

      gridEl.appendChild(card);
    }
  }

  render();
}

// ===================== LISTS PAGE =====================

function initListsPage() {
  const listsContainer = document.getElementById("lists-container");

  let selectedListId = null;

  function render() {
    const lists = getLists();
    listsContainer.innerHTML = "";

    // Create New List button
    const createRow = document.createElement("div");
    createRow.className = "lists-create";

    const createInput = document.createElement("input");
    createInput.type = "text";
    createInput.placeholder = "Enter list name...";
    createInput.maxLength = 40;
    createInput.setAttribute("aria-label", "New list name");
    createInput.className = "lists-create__input";

    const createBtn = document.createElement("button");
    createBtn.type = "button";
    createBtn.className = "lists-create__btn";
    createBtn.textContent = "+ Create New List";

    function doCreate() {
      const name = createInput.value.trim();
      if (!name) return;
      createList(name);
      createInput.value = "";
      render();
    }

    createBtn.addEventListener("click", doCreate);
    createInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") doCreate();
    });

    createRow.appendChild(createInput);
    createRow.appendChild(createBtn);
    listsContainer.appendChild(createRow);

    if (lists.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "status-message";
      emptyMsg.textContent = "No lists yet. Create one above or from a game detail page!";
      listsContainer.appendChild(emptyMsg);
      return;
    }

    for (const list of lists) {
      const card = document.createElement("div");
      card.className = "list-card";

      const header = document.createElement("div");
      header.className = "list-card__header";

      const titleBtn = document.createElement("button");
      titleBtn.type = "button";
      titleBtn.className = "list-card__title";
      titleBtn.textContent = list.name + " (" + list.games.length + ")";
      titleBtn.setAttribute("aria-expanded", selectedListId === list.id ? "true" : "false");

      const controls = document.createElement("div");
      controls.className = "list-card__controls";

      const renameBtn = document.createElement("button");
      renameBtn.type = "button";
      renameBtn.className = "list-card__btn";
      renameBtn.textContent = "Rename";
      renameBtn.setAttribute("aria-label", "Rename " + list.name);

      renameBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        const newName = prompt("Rename list:", list.name);
        if (newName && newName.trim()) {
          renameList(list.id, newName.trim());
          render();
        }
      });

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "list-card__btn list-card__btn--danger";
      deleteBtn.textContent = "Delete";
      deleteBtn.setAttribute("aria-label", "Delete " + list.name);

      deleteBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (confirm("Delete \"" + list.name + "\"? This cannot be undone.")) {
          deleteList(list.id);
          if (selectedListId === list.id) selectedListId = null;
          render();
        }
      });

      controls.appendChild(renameBtn);
      controls.appendChild(deleteBtn);

      header.appendChild(titleBtn);
      header.appendChild(controls);
      card.appendChild(header);

      titleBtn.addEventListener("click", () => {
        selectedListId = selectedListId === list.id ? null : list.id;
        render();
      });

      // Expanded game list
      if (selectedListId === list.id) {
        const gamesContainer = document.createElement("div");
        gamesContainer.className = "list-card__games";

        if (list.games.length === 0) {
          const emptyMsg = document.createElement("div");
          emptyMsg.className = "status-message";
          emptyMsg.textContent = "This list is empty. Add games from their detail page!";
          gamesContainer.appendChild(emptyMsg);
        } else {
          for (const game of list.games) {
            const gameRow = document.createElement("div");
            gameRow.className = "list-card__game";

            const gameLink = document.createElement("a");
            gameLink.href = "game.html?id=" + game.id;
            gameLink.className = "list-card__game-link";
            gameLink.setAttribute("aria-label", "View " + game.name);

            if (game.image) {
              const thumb = document.createElement("img");
              thumb.className = "list-card__game-thumb";
              thumb.src = game.image;
              thumb.alt = game.name;
              thumb.loading = "lazy";
              thumb.onerror = function() { this.style.display = "none"; };
              gameLink.appendChild(thumb);
            }

            const gameInfo = document.createElement("div");
            gameInfo.className = "list-card__game-info";

            const gameName = document.createElement("span");
            gameName.className = "list-card__game-name";
            gameName.textContent = game.name;
            gameInfo.appendChild(gameName);

            if (game.released) {
              const gameDate = document.createElement("span");
              gameDate.className = "list-card__game-date";
              gameDate.textContent = game.released;
              gameInfo.appendChild(gameDate);
            }

            gameLink.appendChild(gameInfo);
            gameRow.appendChild(gameLink);

            const removeBtn = document.createElement("button");
            removeBtn.type = "button";
            removeBtn.className = "remove-btn";
            removeBtn.textContent = "Remove";
            removeBtn.setAttribute("aria-label", "Remove " + game.name + " from " + list.name);
            removeBtn.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();
              removeGameFromList(list.id, game.id);
              render();
            });
            gameRow.appendChild(removeBtn);

            gamesContainer.appendChild(gameRow);
          }
        }

        card.appendChild(gamesContainer);
      }

      listsContainer.appendChild(card);
    }
  }

  render();
}

// ===================== MY REVIEWS PAGE =====================

function initMyReviewsPage() {
  const container = document.getElementById("my-reviews-list");

  function render() {
    const reviews = getAllUserReviews();
    container.innerHTML = "";

    if (reviews.length === 0) {
      const emptyMsg = document.createElement("div");
      emptyMsg.className = "status-message";
      emptyMsg.textContent = "You haven\u2019t written any reviews yet.";
      container.appendChild(emptyMsg);
      return;
    }

    for (const review of reviews) {
      const card = document.createElement("div");
      card.className = "review-card my-reviews-card";

      const gameLink = document.createElement("a");
      gameLink.href = "game.html?id=" + review.gameId;
      gameLink.className = "my-reviews-card__game-link";

      if (review.gameImage) {
        const thumb = document.createElement("img");
        thumb.className = "my-reviews-card__thumb";
        thumb.src = review.gameImage;
        thumb.alt = review.gameName;
        thumb.loading = "lazy";
        thumb.onerror = function() { this.style.display = "none"; };
        gameLink.appendChild(thumb);
      }

      const gameNameEl = document.createElement("span");
      gameNameEl.className = "my-reviews-card__game-name";
      gameNameEl.textContent = review.gameName;
      gameLink.appendChild(gameNameEl);

      card.appendChild(gameLink);

      const header = document.createElement("div");
      header.className = "review-card__header";

      const author = document.createElement("span");
      author.className = "review-card__author";
      author.textContent = review.name;
      header.appendChild(author);

      const date = document.createElement("span");
      date.className = "review-card__date";
      date.textContent = formatDate(review.date);
      header.appendChild(date);

      card.appendChild(header);

      const starsEl = renderStaticStars(review.rating);
      card.appendChild(starsEl);

      const reviewTitle = document.createElement("div");
      reviewTitle.className = "review-card__title";
      reviewTitle.textContent = review.title;
      card.appendChild(reviewTitle);

      const body = document.createElement("div");
      body.className = "review-card__body";
      body.textContent = review.body;
      card.appendChild(body);

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-review-btn";
      deleteBtn.textContent = "Delete My Review";
      deleteBtn.addEventListener("click", () => {
        if (confirm("Delete this review?")) {
          deleteReview(review.gameId, review.id);
          render();
        }
      });
      card.appendChild(deleteBtn);

      container.appendChild(card);
    }
  }

  render();
}

// ===================== HEADER NAV =====================

function initHeaderNav() {
  const toggle = document.getElementById("nav-toggle");
  const nav = document.getElementById("main-nav");
  if (!toggle || !nav) return;

  function openMenu() {
    nav.classList.add("is-open");
    toggle.setAttribute("aria-expanded", "true");
  }

  function closeMenu(returnFocus) {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    if (returnFocus) toggle.focus();
  }

  function isOpen() {
    return nav.classList.contains("is-open");
  }

  toggle.addEventListener("click", () => {
    if (isOpen()) {
      closeMenu(true);
    } else {
      openMenu();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && isOpen()) {
      closeMenu(true);
    }
  });

  nav.addEventListener("click", (e) => {
    if (e.target.classList.contains("main-nav__link")) {
      closeMenu(false);
    }
  });

  document.addEventListener("click", (e) => {
    if (isOpen() && !nav.contains(e.target) && !toggle.contains(e.target)) {
      closeMenu(false);
    }
  });

  // Set active link
  const path = window.location.pathname;
  const links = nav.querySelectorAll(".main-nav__link");
  links.forEach((link) => {
    const href = link.getAttribute("href");
    let isActive = false;
    if (href === "index.html" || href === "/") {
      isActive = path.endsWith("index.html") || path.endsWith("/") || path === "";
    } else {
      isActive = path.endsWith(href);
    }
    if (isActive) {
      link.setAttribute("aria-current", "page");
    }
  });
}

// ===================== SEARCH (shared header) =====================

function initHeaderSearch() {
  const searchInput = document.getElementById("search-input");
  const searchBtn = document.getElementById("search-btn");

  if (!searchInput) return;

  if (isCatalogPage()) {
    const searchParam = getParam("search");
    if (searchParam) {
      searchInput.value = searchParam;
    }
    return;
  }

  function doSearch() {
    const q = searchInput.value.trim();
    window.location.href = "index.html" + (q ? "?search=" + encodeURIComponent(q) : "");
  }

  searchBtn.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSearch();
  });
}

// ===================== INIT =====================

document.addEventListener("DOMContentLoaded", () => {
  initHeaderNav();
  initHeaderSearch();

  const path = window.location.pathname;

  if (path.endsWith("played.html")) {
    initPlayedPage();
  } else if (path.endsWith("favorites.html")) {
    initFavoritesPage();
  } else if (path.endsWith("lists.html")) {
    initListsPage();
  } else if (path.endsWith("my-reviews.html")) {
    initMyReviewsPage();
  } else if (isCatalogPage()) {
    initCatalog();
  } else if (path.endsWith("game.html")) {
    initGameDetail();
  }
});
