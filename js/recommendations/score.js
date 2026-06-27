function slugFrom(item) {
  if (!item) return null;
  if (item.slug) return item.slug;
  if (item.name) return item.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return null;
}

function gameFeatures(game) {
  const features = [];
  if (Array.isArray(game.genres)) {
    for (const g of game.genres) {
      const s = slugFrom(g);
      if (s) features.push(s);
    }
  }
  if (Array.isArray(game.tags)) {
    for (const t of game.tags) {
      const s = slugFrom(t);
      if (s) features.push(s);
    }
  }
  return features;
}

export function scoreGame(game, profile) {
  const features = gameFeatures(game);
  if (features.length === 0) return 0;

  let sum = 0;
  for (const f of features) {
    const gw = profile.genres[f] || 0;
    const tw = profile.tags[f] || 0;
    sum += gw + tw;
  }

  return sum / Math.sqrt(features.length);
}

export function rankRecommendations(candidates, profile, limit = 12) {
  const scored = [];
  for (const game of candidates) {
    const s = scoreGame(game, profile);
    if (s > 0) scored.push({ game, score: s });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
