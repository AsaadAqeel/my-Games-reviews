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
