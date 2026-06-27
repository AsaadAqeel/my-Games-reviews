function topGenreSlug(game) {
  if (!Array.isArray(game.genres) || game.genres.length === 0) return null;
  const first = game.genres[0];
  if (!first) return null;
  if (first.slug) return first.slug;
  if (first.name) return first.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return null;
}

export function diversify(rankedGames, limit = 12) {
  if (!Array.isArray(rankedGames) || rankedGames.length === 0) return [];

  const result = [];
  const genreCount = {};
  const pool = rankedGames.slice();

  while (result.length < limit && pool.length > 0) {
    let bestIdx = 0;
    let bestEffective = -Infinity;

    for (let i = 0; i < pool.length; i++) {
      const { game, score } = pool[i];
      const genre = topGenreSlug(game);
      const used = genre ? (genreCount[genre] || 0) : 0;
      const effective = score * (1 / (1 + 0.5 * used));

      if (effective > bestEffective) {
        bestEffective = effective;
        bestIdx = i;
      }
    }

    const picked = pool.splice(bestIdx, 1)[0];
    const genre = topGenreSlug(picked.game);
    if (genre) {
      genreCount[genre] = (genreCount[genre] || 0) + 1;
    }
    result.push(picked);
  }

  return result;
}
