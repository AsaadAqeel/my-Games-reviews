# Checkpoint

A personal website for finding video games and saving my own reviews and ratings.

**Live site:** https://asaadaqeel.github.io/my-Games-reviews/

---

## Why I built this

I built Checkpoint as a learning project, with two goals in mind:

- **Improve my coding skills.** I wanted to practice building a real, working website
  from scratch using plain HTML, CSS, and JavaScript — no frameworks and no build tools —
  so I actually understand what every part of the code is doing.
- **Practice working with AI.** A big part of this project was learning how to work
  effectively with AI coding assistants: how to describe a problem clearly, write good
  prompts, review the code that comes back, catch bugs, and ask for fixes.

On top of being a learning exercise, I also wanted something genuinely useful for myself:
**a place to save my own game reviews and ratings** and keep track of the games I care
about — what I've played, what I want to remember, and what I'd recommend.

---

## What it does

- **Browse games** pulled live from the [RAWG](https://rawg.io) video game database.
- **Search** for games by title.
- **Filter and sort** by genre, platform, rating, release date, and popularity.
- **Game detail pages** with cover art, screenshots, description, developers, platforms,
  and the RAWG / Metacritic scores.
- **Write my own reviews** with a 1–5 star rating, a title, and a body — saved on my device.
- **Mark games as Played** and keep a list of everything I've finished.
- **Favorite games** with a star, and view them all on a Favorites page.
- **Create custom lists** to organize games however I want.
- **My Reviews page** that gathers every review I've written in one place, with the option
  to delete any of them.

---

## How it's built

This is a fully **static site** — just HTML, CSS, and JavaScript, hosted for free on
GitHub Pages. There is no backend and no database.

- **Game data** comes from the RAWG API, fetched in the browser.
- **My reviews, ratings, played games, favorites, and lists** are all saved in the
  browser's **localStorage**, so they stay on whichever device I used to add them.

### Tech

- Vanilla HTML, CSS, and JavaScript (no frameworks, no bundlers, no build step)
- [RAWG API](https://rawg.io/apidocs) for game data
- `localStorage` for saving reviews and lists
- GitHub Pages for hosting

### Project structure

```
index.html        Catalog / home page
game.html         Game detail page
played.html       Games I've marked as played
favorites.html    Favorited games
lists.html        My custom lists
my-reviews.html   All the reviews I've written
css/styles.css    Styles (dark red & black theme)
js/config.js      RAWG API key + base URL
js/rawg.js        RAWG API calls
js/storage.js     localStorage logic (reviews, played, favorites, lists)
js/app.js         App logic and rendering
```

---

## A note on privacy

All reviews and lists are stored locally in your own browser. Nothing is uploaded to a
server, and reviews are not shared between visitors — each person sees only what they
saved on their own device.

---

## Credits

Game data powered by [RAWG](https://rawg.io). This project uses the RAWG API under their
free tier for personal use, with attribution as required by their terms.

Built as a personal learning project to grow my coding and AI skills. 🎮
