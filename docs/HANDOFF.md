# Handoff checklist (Oct 18, 2026)

Read `CLAUDE.md` first. This is the to-do list for whoever picks up next.

## 1. Branches waiting on review (merge in this order)

- [ ] **`feat/wec-redesign`**: the Whole Earth Catalog redesign. It includes kind-of-find pin marks, catalog-entry popups, the bar tabs (ripe now / almanac / nearest), Vollkorn + Hanken Grotesk, and these later fixes:
  - cluster taps zoom in
  - "take me there" follows the fruit filter
  - almanac overflow
  - no sideways page scroll (`html, body { overflow: hidden }`; `100%` instead of `100vw`)
- [ ] **`feat/medicinal-plants`**, stacked on the redesign: 25 new medicinal plants plus 6 moved over from herbs/greens (chamomile, yarrow, plantain, cleavers, catnip, lemon balm). It adds a 9th "medicinal" family with a five-petal mark, harvest-season data, and a dotted-box caution on medicinal popups.

## 2. Check before merging

- [ ] Firefox responsive mode at **402×874** and **240×427**: is the bottom bar or Jelly panel still cut off on the right? Is zoom still off-centre? Chromium couldn't reproduce this, so the overflow fix is unconfirmed. If it persists, get the computed widths of `html`, `.main-layout` and `.guest-bar`.
- [ ] Real iPhone in Safari: bar, tabs, popups, add a find, sign in.
- [ ] Real Jelly Star: FAB panel, popups. Known older issue: the popup overlaps the zoom controls.
- [ ] Desktop ≥1024 wide.
- [ ] Medicinal plants: the season months in `client/utils/fruitSeasons.js` are approximate (when the flower or leaf is usually picked). Someone who knows the plants should review them. Also decide:
  - Should "ripe now" read "in season" for flowers and leaves?
  - Should the caution also appear in the add-a-find modal?
  - Is white sage OK to list? It's over-harvested and culturally sensitive.

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
