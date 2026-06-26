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
