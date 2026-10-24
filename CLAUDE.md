# CLAUDE.md — fruit for all

A mobile-first community map of free street fruit ("open source orchard"). Live at https://fruitforall.app. GPL-3.0.

Guests can browse the map. Signed-in users can add a pin at their current GPS location, edit or delete their own pins, and filter to "my pins". Anyone can tap "still good?" to confirm a pin.

## Commands

```sh
npm run dev      # esbuild dev server :3000 + nodemon Express :8080 (needs .env)
npm run build    # production bundle → dist/ (Railway runs this on deploy)
npm start        # node server.js — serves dist/ + /api
npm test         # node --test tests/server/*.test.js tests/client/*.test.js
```

- The pre-commit hook (husky) runs `npm test`. CI runs tests, a build, and `npm audit` (warn only).
- Node 22 (pinned: `.nvmrc`, `engines`, CI). ESM throughout (`"type": "module"`).
- **Do not "simplify" the `NODE_ENV` quoting in package.json** (`\\\"production\\\"`). esbuild needs a JS string literal; without it React crashes with `development is not defined`.
- `dist/` is gitignored. `npm run build` wipes and rebuilds it. In dev, esbuild serves on :3000 with `--serve-fallback`, so app routes like `/reset-password` work locally too.

## Stack

| Layer | Tech |
|---|---|
| Client | React 18 **class components**, react-leaflet 4 / Leaflet 1.9, bundled by esbuild (no framework, no router) |
| Server | Express 4, helmet, compression, express-rate-limit (in-memory, or Redis via `REDIS_URL`) |
| Data | AWS DynamoDB raw SDK (no ORM): `LoquatUsers` (PK `userName`), `LoquatPins` (PK `pinId`, SK `createdAt`; GSIs `status-index`, `submittedBy-index`, both sorted by `createdAt`) |
| Auth | bcrypt (12 rounds) + stateless 7-day JWT stored in `localStorage` (`ffa_auth_token`, `ffa_user`) |
| Email | Resend (optional; it's skipped if `RESEND_API_KEY` is unset) |
| External | Stadia `stamen_terrain` tiles, ipapi.co (IP → approximate location, `/api/locate`), phzmapi.com (USDA zone on pin create) |
| Hosting | Railway (Nixpacks); `GET /health` for checks |

## Layout of the code

```
server.js                     Helmet/CSP, CORS, rate limiters, static + SPA catch-all, ALL route wiring
server/controllers/           auth.js (register/login/reset, verifyToken), pinsController.js, index.js (barrel)
server/schemas/               users.js, pins.js (Dynamo access), validation.js, zone.js, errors.js, schemas.js (barrel)
server/utils/                 html.js (escapeHtml), profanity.js, confirmDedup.js (Redis 24h per-IP dedup)
client/index.js               entry: App wires Sidebar ↔ Map via refs; /reset-password renders ResetPassword
client/sidebar.jsx            ALL non-map UI (~1.5k lines): auth state + handlers, add-a-find modal, filters, three layouts
client/map.jsx                Leaflet map, pin loading/merging, clustering, popups, locate-me, "nearest good bet"
client/components/            PinPopup.jsx (catalog-entry popup), AuthForm.jsx (sign in / register / forgot password for all three layouts; `variant` = bar | panel | desktop, state stays in Sidebar), SeasonStrip.jsx (now unused); AddFruitPopup/GuestBar/MapControls are EMPTY placeholders
client/utils/                 auth, cache, network (fetchWithRetry), clustering, fruitList, fruitSeasons, fruitFamilies (marks), pinSummary (ripeness, view summary), zoneFallback (shared with server), breakpoints, …
client/stylesheets/           sidebar.css (tokens + every non-map layout), map.css (Leaflet overrides, controls, popups)
client/sw.js                  service worker (production only): network-first navigations, cache-first static assets
```

`client/utils/fruitList.js` is imported by the **server** too (it's the allow-list for `fruitType`). Keep it dependency-free.

## The three responsive layouts (read this before touching UI)

The JS decides which tree renders (`Sidebar.render()`), and CSS styles each tree. These are three separate DOM trees, not one tree restyled by CSS.

| Mode | Width | JS flag / render fn | Main CSS | Target device |
|---|---|---|---|---|
| **Tiny** | ≤ 360px | `isTinyScreen` → `renderMobileLayout()` (FAB + floating panel) | `sidebar.css` "Mobile compact layout", `map.css` `@media (max-width: 360px)` | Unihertz Jelly Star (≈240×427 CSS px) |
| **Standard mobile** | 361–768px | `isStandardMobile` → `renderGuestBar()` (guest) / `renderAuthenticatedBar()` (signed in) | `sidebar.css` "Standard mobile (361–768px)" `.guest-bar*`, `.auth-bar*` (**not** inside a media query; they apply because the JS renders them) | iPhone SE 2022 (375×667), modern phones (390–430 wide) |
| **Desktop** | > 768px | default branch: floating `.sidebar` card | `sidebar.css` top section | laptop/desktop |

Rules:
- JS breakpoints live in `client/utils/breakpoints.js` (used by sidebar.jsx, index.js and `PanToPin`). CSS repeats them as `@media` blocks: **change both together.**
- Never let a fix for one mode leak into another. Tiny-mode CSS lives under `@media (max-width: 360px)`; standard-mobile selectors are `.guest-bar*` / `.auth-bar*`.
- The `@media (max-width: 768px)` and `480px` blocks in sidebar.css mostly target `.sidebar`, which phones never render, but the global `button:not(...)` rule inside them **does** shrink popup and pin buttons on phones.
- The standard-mobile bar is `position: fixed` and sits above the map. Sidebar publishes its live height as the CSS variable `--bottom-chrome` (ResizeObserver via `setBottomBarRef`). Anything near the bottom of the map must use it: `.leaflet-bottom`, popup max-height and `PanToPin` already do. Phones and the Jelly (≤ 768) have no + / − buttons (pinch and double-tap zoom; the corner is kept clear for a busy map): locate-me is the only map control, a round printed stamp in the top-right corner. Desktop keeps zoom (top right, printed card) and locate (bottom right).
- The bar has two states, toggled by the grab handle (`renderBarHandle`). Collapsed: month + "N in season · M finds in view" + add a find (`renderBarHeader`). Open: tabs **in season / almanac / nearest** (`renderBarPanel`), then filter + links (guest) or my pins + filter + sign out (signed in). Open by default on a first visit only (key `ffa_guest_bar_seen`). `Sidebar.collapse()` (called when a pin opens) folds both.
- The bar's data comes from the map: `publishPinSummary` sends `detail.summary` = `buildViewSummary()` (client/utils/pinSummary.js, pure + tested) on every viewport change. Bar entries call `ffa:fly-to` to pan to a find; the map's empty-area card fires `ffa:add-find`.
- iOS Safari zooms the page when a focused input's font-size is < 16px. Keep form inputs at ≥ 16px on phones.
- Test at **240×427, 375×667, 393×852 and ≥1024 wide** (the CONTRIBUTING doc's 360/480 widths do not hit the 361–768 tree well).

## Design system (non-negotiable aesthetic)

"Earthy, crunchy, Whole Earth Catalog."
- Palette: **block print** (Oct 2026, after the Chez Panisse cookbook prints). Tokens live in `:root` in sidebar.css: paper `--paper`/`--surface #f7f1e3`, key ink `--text #2a2420`, `--text-muted #66584c`, and four inks with one job each: `--fig #5b3a5e` (accent: buttons, the month, yours), `--leaf #4f6b3a` (in season), `--persimmon`, `--citron`, `--sage` (colour blocks only; too light for text). The old names `--red*`, `--olive`, `--del` are aliases of fig/leaf so legacy selectors keep working. Use the tokens, not new hex values.
- Type: **Vollkorn** (`--font`) for names, headings and italic notes; **Hanken Grotesk** (`--font-sans`) for labels, counts and access/season lines — the catalog set reviews against Univers. Both load **only** via the `<link>` in `client/map-index.html` (never CSS `@import`).
- Catalog vocabulary: thick-over-thin rules for section heads, a thin meandering rule between entries, thick dotted boxes for editorial asides, italic notes signed `—name`. Physical-object skeuomorphism (torn paper, tags, ovals around images) was explored and rejected.
- Pins: one hand-cut mark per *kind of find* (`client/utils/fruitFamilies.js`: tree, citrus, tropical, berries, nuts, mushrooms, herbs, greens, medicinal + `seed` fallback). Every FRUIT_LIST item must map to a family (a test enforces it). Medicinal plants also need `FRUIT_SEASONS` data (tested); their popup and the add-a-find form carry a dotted-box caution (`.entry-caution`, `.add-find-caution`). White sage is deliberately not listed. Each mark prints as two blocks: a flat colour shape (`BLOCKS` in fruitFamilies.js, `markSvg(…, { block: true })`) under the ink linework, 1.4 units out of register. State: in season = paper disk, leaf ring, colour block; yours = solid fig disk, paper linework (a fill, so it reads without colour vision); not in season = smaller, muted ring, no block (not faded: faded pins vanish on the inked map); stale (no sign of life in 6 months) = dashed ring. Clusters: ink ring over an offset citron disk.
- Logo: one block-print loquat and its leaf (`client/utils/logo.js`, rendered by `Sidebar.renderLogo`), the same drawing at every size; only the ink weight scales. A four-fruit cluster was tried and rejected as too busy. The static icons in the repo root (`favicon.svg`, `loquat-48/192/512.png`) were generated from it with `HEX_INKS`: regenerate them if the mark changes, and bump `CACHE_VERSION` in `client/sw.js`.
- User-facing copy says **"in season"**, never "ripe" (flowers and leaves aren't ripe). Code identifiers (`ripeCount`, `ripenessOf`) still say ripe.
- Seasons follow the **find's location**: `zoneOf(pin)` = the zone saved at creation (phzmapi.com), else `detectZoneFallback` on the pin's coordinates. An empty view uses the map centre. Never fall back to "any zone" or a fixed zone.
- Lowercase copy and labels. Restrained shadows (≤ `5px 6px 10px rgba(0,0,0,.22)`), tactile outset/inset borders, no slick gradients.
- Printed surfaces: buttons filled with fig sit on a persimmon block printed off register (`box-shadow: 3px 3px 0 var(--persimmon)`, no border, 3px radius; pressed = `translate(3px, 3px)` onto the block). That covers every primary action ("add a find", sign in, "take me there", "directions", my pins, save, use my location); a toggle that is on (`.btn-active`) stays pressed onto the block. Secondary and destructive actions (cancel, delete, "still good?") are an ink outline on paper with no fill or block, and are excluded from the global `button:not(...)` rule. Cards (popup, Jelly panel, reset page) are paper with a 1px ink keyline, 2px radius and a fig offset shadow. A season is always a row of persimmon dots (popup band, almanac). Signed-out form fields are paper, a muted keyline, Vollkorn, left-aligned with italic placeholders.
- Map tiles are re-inked by `#ffa-duotone`, an inline SVG filter in `client/map-index.html` (tile lightness → key ink … paper), applied per tile in map.css. Keep the SVG in the HTML: Firefox hides an element whose filter points at a missing id.
- Map controls are printed like the rest: the desktop zoom is a paper card with an ink keyline and a fig offset; locate-me is a round stamp like the clusters (paper, ink ring, citron offset).
- A huge global `button:not(.a):not(.b)…` rule in sidebar.css gives every button the red style. A new button class that should look different must be added to **every** copy of that selector (base, :hover, :active, and the 768/360 media blocks). They have already drifted, so check all of them.

## Conventions

- React **class components** (repo convention; PinPopup/SeasonStrip are function components and that's fine). Lowercase identifiers. Prettier is installed.
- Client fetches go through `fetchWithRetry` with an `AbortController` registered on the component; always prefix with `API_BASE` (empty in prod, `http://localhost:8080` in dev).
- Sidebar ↔ Map communicate via refs from `App` **and** window CustomEvents (`ffa:pins-summary`, `ffa:nearest-good-bet`).
- Server handlers: validate input types **before** using string methods, and wrap the whole body in try/catch. An exception thrown in an async Express 4 handler is an unhandled rejection that kills the Node process.
- Dynamo pin-list failures throw `PinsQueryError` → handlers return 503 via `sendPinsError` (never an empty map).
- Public responses must never include `submittedBy` (stripped in `getPublicPins`).
- New third-party hosts the browser talks to must be added to the helmet CSP in server.js (`connectSrc`/`imgSrc`).
- Production builds content-hash every file, including the entry (`--entry-names`); `scripts/build-html.mjs` rewrites `dist/index.html` to point at them. The SW serves `.js`/`.css` cache-first, which is only safe because names change. Bump `CACHE_VERSION` in `client/sw.js` when the caching strategy or precache list changes.
- The Resend SDK returns `{ data, error }` instead of throwing. Wrap every send with `logEmailResult()` (server/utils/email.js).
- On boot the server logs `[config] … usersTable=… pinsTable=…`. Check that line first when production and local disagree.
- Add tests under `tests/server` or `tests/client` for any new util; `node:test`, no extra deps.

## Environment

`.env` (never commit): `NODE_ENV`, `JWT_SECRET` (required when NODE_ENV=production), `AWS_REGION`, `DYNAMODB_USERS_TABLE`, `PINS_TABLE`, `ALLOWED_ORIGINS`, `PORT`, `STADIA_API_KEY`. Optional: `REDIS_URL`, `RESEND_API_KEY`, `APP_URL`, `ADMIN_EMAIL`, `PIN_NOTIFICATIONS=true`.
Never print or paste `.env` values. AWS creds come from env or `~/.aws`.

## Known issues / open review items

The working checklist for the next session is `docs/HANDOFF.md`.


See the improvement review (Oct 2026). Still open:
- **Decided Oct 2026: move off DynamoDB to Postgres (+ PostGIS on Railway)** for location queries, real constraints (unique email, case-insensitive usernames) and reporting. Until then, local `npm run dev` writes to the production tables.
- Email lookups and password reset use an unpaginated `Scan`, which breaks past ~1 MB of users. Bounded pin queries read the whole `status-index` and filter in memory.
- The auth forms are one component (`client/components/AuthForm.jsx`). Each `variant` keeps the DOM its layout's CSS targets (e.g. `.auth-section form`, `.guest-bar-form`), so change a variant's structure only together with its CSS.

Fixed on `fix/hotfixes` (keep these true):
- Admin is never derived from the username; reserved names are blocked case-insensitively (`validateUserName`). Edit/delete re-check `isAdmin` in DynamoDB, not just the JWT.
- Every route handler is wrapped with `wrap()` (server/utils/wrap.js); new routes must be too. Request bodies are type-checked (`validatePinInput`, `validateNotes`) before string methods run.
- "still good?" dedup uses an in-memory store when `REDIS_URL` is unset.
- Season helpers are imported in PinPopup (no `window.*` globals). Passwords are never trimmed. POSTs are never auto-retried.

## Docs

`README.md` (setup), `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `CONTRIBUTING.md`, `DYNAMODB_GSI_SETUP.md`, `non-jelly-home-implementation-map.md` (standard-mobile UI history). `.github/copilot-instructions.md` is gitignored (local only). This file is the committed equivalent.
