const REVIEWS_KEY = "gameReviews";

function getAllReviews() {
  try {
    const data = localStorage.getItem(REVIEWS_KEY);
    return data ? JSON.parse(data) : {};
  } catch {
    return {};
  }
}

function saveAllReviews(allReviews) {
  try {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(allReviews));
  } catch {
    // storage full or unavailable
  }
}

export function getReviews(gameId) {
  const all = getAllReviews();
  return (all[gameId] || []).sort((a, b) => b.date - a.date);
}

export function addReview(gameId, review) {
  const all = getAllReviews();
  if (!all[gameId]) all[gameId] = [];
  all[gameId].push({
    id: Date.now(),
    rating: review.rating,
    title: review.title,
    body: review.body,
    name: review.name || "Anonymous",
    date: Date.now()
  });
  saveAllReviews(all);
  return all[gameId];
}

export function getAverageRating(gameId) {
  const reviews = getReviews(gameId);
  if (reviews.length === 0) return null;
  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  return (sum / reviews.length);
}

export function getReviewCount(gameId) {
  return getReviews(gameId).length;
}

export function getAllAverages() {
  const all = getAllReviews();
  const result = {};
  for (const [gameId, reviews] of Object.entries(all)) {
    if (reviews.length > 0) {
      const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
      result[gameId] = {
        average: sum / reviews.length,
        count: reviews.length
      };
    }
  }
  return result;
}

// ===================== PLAYED GAMES =====================

const PLAYED_KEY = "playedGames";

function getAllPlayed() {
  try {
    const data = localStorage.getItem(PLAYED_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAllPlayed(list) {
  try {
    localStorage.setItem(PLAYED_KEY, JSON.stringify(list));
  } catch {
    // storage full or unavailable
  }
}

export function getPlayedGames() {
  return getAllPlayed().sort((a, b) => b.addedAt - a.addedAt);
}

export function isPlayed(gameId) {
  return getAllPlayed().some(g => g.id === Number(gameId));
}

export function togglePlayed(gameId, snapshot) {
  const list = getAllPlayed();
  const id = Number(gameId);
  const idx = list.findIndex(g => g.id === id);
  if (idx !== -1) {
    list.splice(idx, 1);
  } else {
    list.push({
      id: snapshot.id,
      name: snapshot.name,
      image: snapshot.image,
      rating: snapshot.rating,
      released: snapshot.released,
      addedAt: Date.now()
    });
  }
  saveAllPlayed(list);
  return idx === -1;
}

export function removePlayed(gameId) {
  const list = getAllPlayed().filter(g => g.id !== Number(gameId));
  saveAllPlayed(list);
}

// ===================== LISTS =====================

const LISTS_KEY = "gameLists";

function getAllLists() {
  try {
    const data = localStorage.getItem(LISTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAllLists(lists) {
  try {
    localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
  } catch {
    // storage full or unavailable
  }
}

export function getLists() {
  return getAllLists();
}

export function createList(name) {
  const lists = getAllLists();
  const newList = {
    id: Date.now(),
    name: name,
    createdAt: Date.now(),
    games: []
  };
  lists.push(newList);
  saveAllLists(lists);
  return newList;
}

export function renameList(listId, newName) {
  const lists = getAllLists();
  const list = lists.find(l => l.id === listId);
  if (list) {
    list.name = newName;
    saveAllLists(lists);
  }
}

export function deleteList(listId) {
  const lists = getAllLists().filter(l => l.id !== listId);
  saveAllLists(lists);
}

export function addGameToList(listId, snapshot) {
  const lists = getAllLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return false;
  if (list.games.some(g => g.id === snapshot.id)) return false;
  list.games.push({
    id: snapshot.id,
    name: snapshot.name,
    image: snapshot.image,
    rating: snapshot.rating,
    released: snapshot.released,
    addedAt: Date.now()
  });
  saveAllLists(lists);
  return true;
}

export function removeGameFromList(listId, gameId) {
  const lists = getAllLists();
  const list = lists.find(l => l.id === listId);
  if (!list) return;
  list.games = list.games.filter(g => g.id !== Number(gameId));
  saveAllLists(lists);
}

export function isGameInList(listId, gameId) {
  const lists = getAllLists();
  const list = lists.find(l => l.id === listId);
  return list ? list.games.some(g => g.id === Number(gameId)) : false;
}

export function getListGameIds() {
  const lists = getAllLists();
  const ids = new Set();
  for (const list of lists) {
    for (const game of list.games) {
      ids.add(game.id);
    }
  }
  return ids;
}

// ===================== FAVORITES =====================

const FAVORITES_KEY = "favoriteGames";

function getAllFavorites() {
  try {
    const data = localStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function saveAllFavorites(list) {
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(list));
  } catch {
    // storage full or unavailable
  }
}

export function getFavorites() {
  return getAllFavorites().sort((a, b) => b.addedAt - a.addedAt);
}

export function isFavorite(gameId) {
  return getAllFavorites().some(g => g.id === Number(gameId));
}

export function toggleFavorite(gameId, snapshot) {
  const list = getAllFavorites();
  const id = Number(gameId);
  const idx = list.findIndex(g => g.id === id);
  if (idx !== -1) {
    list.splice(idx, 1);
  } else {
    list.push({
      id: snapshot.id,
      name: snapshot.name,
      image: snapshot.image,
      rating: snapshot.rating,
      released: snapshot.released,
      addedAt: Date.now()
    });
  }
  saveAllFavorites(list);
  return idx === -1;
}

export function removeFavorite(gameId) {
  const list = getAllFavorites().filter(g => g.id !== Number(gameId));
  saveAllFavorites(list);
}
