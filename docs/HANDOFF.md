# Handoff checklist (updated Oct 19, 2026)

Read `CLAUDE.md` first. This is the to-do list for whoever picks up next.

## Start here

- Repo: `strangesongs/fruit-for-all`. `main` is live at fruitforall.app (Railway deploys on push to `main`).
- Newest work is on **`feat/in-season`**. It includes everything from the two branches below it, so checking out `feat/in-season` gives the full stack.
- Nothing on these branches is merged or live yet. The owner is testing them on Firefox, iPhone Safari and the Jelly Star before merging.
- Tests: `npm test` (131 passing as of Oct 19).
- Don't start the Postgres migration code before the owner approves a written plan (section 3).
- The owner prefers small PR-sized branches. Stack new work on `feat/in-season` until it's merged, or branch from `main` after.

## 1. Branches waiting on review (merge in this order)

- [ ] **`feat/wec-redesign`**: the Whole Earth Catalog redesign. It includes kind-of-find pin marks, catalog-entry popups, the bar tabs (now "in season" / almanac / nearest), Vollkorn + Hanken Grotesk, and these later fixes:
  - cluster taps zoom in
  - "take me there" follows the fruit filter
  - almanac overflow
  - no sideways page scroll (`html, body { overflow: hidden }`; `100%` instead of `100vw`)
- [ ] **`feat/medicinal-plants`**, stacked on the redesign: 25 new medicinal plants plus 6 moved over from herbs/greens (chamomile, yarrow, plantain, cleavers, catnip, lemon balm). It adds a 9th "medicinal" family with a five-petal mark, harvest-season data, and a dotted-box caution on medicinal popups.
- [ ] **`feat/in-season`**, stacked on medicinal: "in season" wording everywhere, seasons by the find's location, verified bloom months, white sage removed, caution in add-a-find.

## 2. Check before merging

- [ ] Firefox responsive mode at **402×874** and **240×427**: is the bottom bar or Jelly panel still cut off on the right? Is zoom still off-centre? Chromium couldn't reproduce this, so the overflow fix is unconfirmed. If it persists, get the computed widths of `html`, `.main-layout` and `.guest-bar`.
- [ ] Real iPhone in Safari: bar, tabs, popups, add a find, sign in.
- [ ] Real Jelly Star: FAB panel, popups. Known older issue: the popup overlaps the zoom controls.
- [ ] Desktop ≥1024 wide.
- [x] Medicinal plants follow-ups (done on `feat/in-season`):
  - white sage removed
  - caution added to the add-a-find form
  - "in season" replaces "ripe" in all copy
  - seasons follow the find's location
  - 17 of 30 medicinal plants' bloom months checked against sources and corrected
- [ ] Still unverified: harvest months for the rest of the medicinal set (lemon balm, comfrey, mugwort, ginkgo, gotu kola, aloe, horsetail, cleavers, marshmallow, chamomile, hibiscus, plantain, yarrow) and **all ~125 fruit/herb/green entries**. `fruitSeasons.js` was hand-written in an earlier UI commit with no source. A real verification pass needs a source per plant (extension services, USDA PLANTS, Calscape for CA natives).
- [ ] `detectZoneFallback` is a rough continental-US heuristic (LA basin corrected to 10). Pins saved with a phzmapi zone don't need it, but older pins and empty views do. Consider calling phzmapi by ZIP/coords and caching per area, or shipping a coarse zone grid.

## 3. Postgres migration (decided; not started)

- [ ] Stand up a **separate dev database** on Railway (Postgres + PostGIS). Today `npm run dev` writes to the production DynamoDB tables.
- [ ] Write up the schema and migration plan, and **get approval before writing code**. The data move can't be undone. The plan should cover:
  - users with unique email and case-insensitive usernames
  - pins with geography + GIST index
  - confirmations as a table
  - the reset-token storage
- [ ] Data-access layer behind the current `server/schemas/*` functions. Keep the API shape the same.
- [ ] One-off export from DynamoDB → import, run against the dev database first. Then production cutover and keep Dynamo read-only as a backup.
- [ ] This removes the unpaginated user `Scan` and in-memory filtering of `status-index`.

## 4. Backlog (rough priority)

Security / reliability
- [ ] Split the auth rate limiter (login vs register vs reset).
- [ ] Rate-limit and cache `/api/locate` (ipapi.co).
- [ ] Fix the "oldest 200 globally" fallback in pin loading.
- [ ] Review `npm audit` highs.
- [ ] Handle a 401 (expired JWT) by signing out cleanly instead of failing silently.
- [ ] Remove the reset token from the URL after reading it; restyle `ResetPassword.jsx` with tokens.
- [ ] Resend: verify the sending domain/account (reset emails weren't arriving).
- [ ] Pin the Node version (engines + Railway).

Client
- [ ] localStorage cache eviction; bust the HTTP cache after creating a pin; fix stale notes after an edit.
- [ ] Replace `alert()`/`confirm()` with in-app dialogs.
- [ ] Extract a shared `AuthForm` (three copies in sidebar.jsx).
- [ ] Replace the global `button:not(...)` rule (5 copies) with a `.btn` class.
- [ ] Jelly: popup overlaps the zoom controls.

Testing / CI
- [ ] Playwright width matrix in CI: 240×427, 375×667, 393×852, 1280×800.

## Working notes

- The container/CI npm registry was unreachable in the last session. Builds used bun and a copy of `node_modules`. Locally just use `npm run build` / `npm test`.
- Git author from repo history: `j cretella <jcrtll@protonmail.com>`.
- Never print `.env` values. Ask before any irreversible data action.
