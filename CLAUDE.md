# CLAUDE.md — fruit for all

A mobile-first community map of free street fruit ("open source orchard"). Live at https://fruitforall.app. GPL-3.0.

Guests can browse the map, share a find (`/find/<id>`) and report a problem with one. Signed-in users can add a find where they're standing (nudging the pin up to ~100 m to the tree), edit its notes, kind and spot, delete it, and filter to "my pins". Anyone can tap "still good?" to confirm a pin.

## Commands

```sh
npm run dev      # esbuild dev server :3000 + nodemon Express :8080 (needs .env)
npm run build    # production bundle → dist/ (Railway runs this on deploy)
npm start        # node server.js — serves dist/ + /api
npm test         # node --test tests/server/*.test.js tests/client/*.test.js
```

- **Trying a branch on a phone without production:** `npm run build && npm run preview` serves `dist/` on :4173 with a fake in-memory API (`scripts/preview-server.mjs`): any username signs in (`admin…` = admin), sample finds appear near you, the real validation runs, nothing reaches DynamoDB. iPhone Safari only shares location over https: tunnel it (`cloudflared tunnel --url http://localhost:4173`). Tiles go through the preview server: Stadia with `STADIA_API_KEY` from `.env`, else OpenStreetMap's tiles (it logs Stadia's status once if the key is refused).

- The pre-commit hook (husky) runs `npm test`. CI runs tests, a build, and `npm audit` (warn only).
- Node 22 (pinned: `.nvmrc`, `engines`, CI). ESM throughout (`"type": "module"`).
- **Do not "simplify" the `NODE_ENV` quoting in package.json** (`\\\"production\\\"`). esbuild needs a JS string literal; without it React crashes with `development is not defined`.
- `dist/` is gitignored. `npm run build` wipes and rebuilds it. In dev, esbuild serves on :3000 with `--serve-fallback`, so app routes like `/reset-password` work locally too.

## Stack

| Layer | Tech |
|---|---|
| Client | React 18 **class components**, react-leaflet 4 / Leaflet 1.9, bundled by esbuild (no framework, no router) |
| Server | Express 4, helmet, compression, express-rate-limit (in-memory, or Redis via `REDIS_URL`) |
| Data | **Postgres 18 + PostGIS on Railway** since Oct 25, 2026 (`ffa-production`; `ffa-dev` for local work), raw `pg` (no ORM), schema in `server/db/migrations/`. The old DynamoDB tables (`LoquatUsers`, `LoquatPins`) are an untouched backup until late Nov 2026; the DynamoDB code still runs with `DATA_STORE=dynamo` (rollback) until PR 5 removes it |
| Auth | bcrypt (12 rounds) + stateless 7-day JWT stored in `localStorage` (`ffa_auth_token`, `ffa_user`) |
| Email | Resend (optional; it's skipped if `RESEND_API_KEY` is unset) |
| External | Stadia `stamen_terrain` tiles, ipapi.co (IP → approximate location, `/api/locate`), phzmapi.com (USDA zone on pin create) |
| Hosting | Railway (Nixpacks); `GET /health` for checks |

## Layout of the code

```
server.js                     Helmet/CSP, CORS, rate limiters, static + SPA catch-all, ALL route wiring
server/controllers/           auth.js (register/login/reset, verifyToken), pinsController.js, adminController.js (/api/admin/*, requireAdmin), index.js (barrel)
server/db/                    dynamo.js (client + table names), postgres.js (lazy pg pool), migrate.js + migrations/NNN_*.sql, dynamoImport.js (Dynamo item → row, pre-flight check)
server/schemas/               users.js, pins.js (Dynamo access), validation.js, zone.js, errors.js, schemas.js (barrel)
server/utils/                 html.js (escapeHtml), profanity.js, confirmDedup.js (Redis 24h per-IP dedup)
client/index.js               entry: App wires Sidebar ↔ Map via refs; /reset-password renders ResetPassword; /admin renders AdminPage (lazy)
client/sidebar.jsx            ALL non-map UI (~1.5k lines): auth state + handlers, filters, three layouts (renders AddFind)
client/map.jsx                Leaflet map, pin loading/merging, clustering, popups, locate-me, "nearest good bet"
client/components/            AddFind.jsx (add / edit a find: locate → place → details → kinds; see below), PinPopup.jsx (catalog-entry popup), AuthForm.jsx (sign in / register / forgot password for all three layouts; `variant` = bar | panel | desktop, state stays in Sidebar), SeasonStrip.jsx (now unused), AdminPage.jsx (the command center, /admin; styles admin.css); AddFruitPopup/GuestBar/MapControls are EMPTY placeholders
client/utils/                 auth, cache, network (fetchWithRetry), clustering, fruitList (+ FRUIT_ALIASES), kindSearch, findPlacement (nudge range, shared with server), fruitSeasons, fruitFamilies (marks), pinSummary (ripeness, view summary), zoneFallback (shared with server), breakpoints, …
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
- The `@media (max-width: 768px)` and `480px` blocks in sidebar.css mostly target `.sidebar`, which phones never render, but the `.btn` rules inside them **do** shrink popup and pin buttons on phones.
- The standard-mobile bar is `position: fixed` and sits above the map. Sidebar publishes its live height as the CSS variable `--bottom-chrome` (ResizeObserver via `setBottomBarRef`). Anything near the bottom of the map must use it: `.leaflet-bottom`, popup max-height and `PanToPin` already do. Phones and the Jelly (≤ 768) have no + / − buttons (pinch and double-tap zoom; the corner is kept clear for a busy map): locate-me is the only map control, a round printed stamp in the top-right corner. Desktop keeps zoom (top right, printed card) and locate (bottom right).
- The bar has two states, toggled by the grab handle (`renderBarHandle`). Collapsed: month + "N in season · M finds in view" + add a find (`renderBarHeader`). Open: tabs **in season / almanac / nearest** (`renderBarPanel`), then filter + links (guest) or my pins + filter + sign out (signed in). Open by default on a first visit only (key `ffa_guest_bar_seen`). `Sidebar.collapse()` (called when a pin opens) folds both.
- The bar's data comes from the map: `publishPinSummary` sends `detail.summary` = `buildViewSummary()` (client/utils/pinSummary.js, pure + tested) on every viewport change. Bar entries call `ffa:fly-to` to pan to a find; the map's empty-area card fires `ffa:add-find`.
- iOS Safari zooms the page when a focused input's font-size is < 16px. Keep form inputs at ≥ 16px on phones.
- Test at **240×427, 375×667, 393×852 and ≥1024 wide** (the CONTRIBUTING doc's 360/480 widths do not hit the 361–768 tree well).

## Add a find / edit a find (Oct 2026)

- `client/components/AddFind.jsx` (styles: `client/stylesheets/addFind.css`) is rendered by every layout through `Sidebar.renderAddFruitPopup()` while `state.addFind` is set (`{ mode: 'add' }` or `{ mode: 'edit', pin }`). It adds `body.ffa-adding`, which hides that layout's own chrome (bar, shelf, Jelly FAB/panel, desktop sidebar).
- Steps: **locating** (fresh high-accuracy fix) → **placing** (the map moves under a pin fixed mid-map; dashed range circle) → **details** (the spot in words, "what's there", notes) ⇄ **kinds** (the whole list grouped by family, with search that knows other names) → save. No location = no adding (it explains how to allow it); admin may place anywhere, with no range.
- Range: `NUDGE_LIMIT_M` = 100 m from your fix (editing: from where the find was) in `client/utils/findPlacement.js`. The map pulls the pin back on `moveend`; the server re-checks moves on PATCH (`withinNudge`, +10 m slack; admin exempt). It can't check a create (it never sees your GPS).
- AddFind ↔ map talk through window events: `ffa:place-start`, `ffa:place-move` (map → form: centre, distance, `atLimit`, finds within 30 m), `ffa:place-spot`, `ffa:place-end`, `ffa:find-saved` (map upserts the pin, flies there, opens its popup; no reload). The popup's "edit" fires `ffa:edit-find`; `ffa:notice` shows the short line after a save or delete.
- Same kind within 15 m of the spot → a dotted aside suggesting "still good" instead (it doesn't block).
- `PATCH /api/pins/:id` takes any of `notes`, `fruitType`, `coordinates` (validated by `validatePinUpdate` before anything else); a move re-detects the zone. The client sends only what changed.
- Delete asks inside the popup (no `confirm()`); every add/edit/delete error is shown in place (`saveErrorMessage`), never `alert()`.
- FRUIT_LIST is ~240 kinds. New kinds need a family (tested); medicinal ones also need season data. Kinds without season data say "season varies" and stay off the in-season shelf. Other names (`FRUIT_ALIASES`, e.g. pineapple guava → feijoa) are search-only: what's saved is the list name.

## A link per find, and reports (Oct 2026)

- Every find has a page: `/find/<pinId>` (`client/utils/findLinks.js`: `findPath`, `pinIdFromPath`; ids are v4 UUIDs). The server answers it with the app plus that find's title and Open Graph tags (`makeFindPage` → `server/utils/findPage.js`, which swaps the `share:start…share:end` block in `client/map-index.html`; keep those markers). Preview text comes from `findSummary` (kind, season at the find's zone, the note; never who added it).
- The map reads the id on load (`openLinkedFind`): `GET /api/pins/:id`, then it opens that find at z17 and loads the area around it. While a link "holds the view" (`linkHoldsView()`), the IP/precise location is noted but not flown to; pressing locate-me releases it. A find that's gone shows `ffa:notice` and carries on as a normal visit.
- The address bar follows the open popup (`syncFindUrl`, `history.replaceState`, keeps `?landing=…`), and so does the tab title.
- Popup: "share" (system share sheet, else copy the link, else show it) for everyone; "report a problem" for anyone who can't edit the find. Reasons in `REPORT_REASONS` (gone, private property, unsafe, a different plant, something else + note). `POST /api/pins/:id/report`: once per find per IP per day, stored on the pin (`reports`, `reportCount`; never returned to browsers), emailed to `ADMIN_EMAIL`; the find stays up.
- `getPinById` throws `PinsQueryError` on a database failure (it used to return null, i.e. "no such find").

## The admin command center (Oct 2026, in progress)

The approved plan is the "Admin command center plan" doc (owner approved Oct 26; desktop only); the screens are on the design canvas ("the admin command center" row). Three PRs: `admin/history` (data + API, #47) → `admin/page` (the `/admin` page and the sidebar's "command center · N reports" link, #48) → `admin/season-coverage` (the season-data section).

- `003_admin.sql`: `pin_reports` gains `handled_at`, `handled_by`, `outcome` (`kept` | `hidden`); `pin_events` is the history (`added`, `edited` with `fields` ⊂ notes/kind/spot, `hidden`, `restored`, `deleted`, `still-there`, `report-handled`), written in the same statement or transaction as the change. `pin_id` there is not a foreign key, so a deleted find's history stays. `createPin`/`updatePin`/`deletePin` take an optional `{ by }` (who acted); `by` is matched to the stored name ignoring case, and an unknown name records null rather than failing the change.
- **Hidden finds** (`status = 'removed'`, set only from the command center) are "no such find" everywhere outside `server/schemas/pg/admin.js`: the map, "my pins", `GET /api/pins/:id`, `/find/<id>`, still good, report, edit, delete. "put it back" restores them. Your own delete stays a real delete.
- `server/schemas/pg/admin.js` has **no DynamoDB twin** (the one exception to the twin rule): the barrel's `getAdminSummary`, `getAdminOverview`, `handleReport`, `hidePin`, `restorePin`, `markStillThere` throw `AdminUnavailableError` on `DATA_STORE=dynamo` (503).
- Routes (`server.js`, all `...adminOnly`: no token → 404, `verifyToken`, `requireAdmin`): `GET /api/admin/summary` (counts), `GET /api/admin/overview` (open + handled reports, recent activity, finds to review, hidden finds), `POST /api/admin/reports/:id/handle`, `POST /api/admin/pins/:id/hide|restore|still-there`. Anyone who isn't an admin in the users table gets the same 404 as an unknown route. Answers are `no-store`; they name who added a find but never carry an email.
- "Finds to review" uses the map's stale rule (no add or "still good" for 6 × 30.44 days, `client/utils/timeAgo.js`). Recent activity is `pin_events` plus adds from before history began (`pins.created_at`) and visitors' "still good" taps (`pin_confirmations`).
- The report email links to `/admin#reports`.
- **The page** (PR 2): `client/components/AdminPage.jsx`, its own lazy chunk (`index.js` checks `isAdminPath`). Signed out or not an admin (in localStorage, and again by the API's 404) → `location.replace('/')`. Below 768 px: one line ("the command center is for a computer") and back to the map. Sections: reports (handled, it's fine · hide the find · open on the map → `/find/<id>`; a "handled (N)" fold), recent activity, finds to review (still there · hide), hidden (put it back). Actions POST once (never retried) and reload the overview; errors show under the row. Words live in `client/utils/adminView.js` (tested), including short reason tags (`REASON_TAGS`; the reporter's form says "it's gone" etc.). The page scrolls inside `.admin-page` (html/body never scroll) and undoes sidebar.css's global `ul`/`li` rules.
- **The way in:** the desktop sidebar (signed in, `isAdmin()`) shows a dotted-box link "command center · N open reports" between the filter and logout (`renderAdminEntry`, `GET /api/admin/summary` on mount, sign-in, or widening to desktop; styles at the end of sidebar.css). Signing in still lands on the map.
- The preview server (`npm run preview`) fakes the admin API with the same shapes, plus two sample reports; sign in as `admin…` and open `/admin`.
- **Season data** (PR 3): computed in the browser from the code, not the database. `client/utils/seasonSources.js` (`SEASON_CHECKS`: kind → `{ how: verified | changed | bloom, sources }`) mirrors the status table in `docs/season-sources.md`; `tests/client/seasonSources.test.js` fails when they disagree or when an entry with months has no row in the doc. `seasonCoverage()` (`client/utils/seasonCoverage.js`) counts every FRUIT_LIST kind per family as checked / not checked / no months, and lists the kinds with no months. **When you check a batch of seasons, update the doc row and `SEASON_CHECKS` together.**

## Postgres (live since Oct 25, 2026)

The approved plan is the "Postgres migration plan" doc (owner approved every recommendation, Oct 25). PRs #41–#45 are merged; production switched on **Oct 25, 2026, ~6:30 pm PT** (`DATA_STORE=postgres`, `DATABASE_URL=${{ffa-production.DATABASE_URL}}` on the `loquat` service; 10 users and 15 finds copied and verified field by field; `testuser` left behind). DynamoDB backups `ffa-pre-postgres-users` / `-pins` were taken first. Left: PR 5 (`db/drop-dynamo`, late Nov 2026) removes the DynamoDB code; deleting the tables is the owner's call.

- Schema: `server/db/migrations/001_init.sql` (users, password_resets, pins with `geography(point, 4326)` + GIST, pin_confirmations, pin_reports). Never edit a migration that has run; add `002_…`. `npm run db:migrate` applies pending ones to `DATABASE_URL` (prints host/db first; advisory-locked; one transaction per file).
- Usernames keep their typed case but are unique ignoring case (`lower(user_name)`); emails are stored lower case and unique. Report reasons are a check constraint that must match `REPORT_REASONS` (a test compares them).
- `npm run db:check` = `scripts/dynamo-to-pg.mjs --check`: read-only paginated Scan of both tables, prints counts and anything that would block a load (case clashes, shared emails, finds with no account, bad coordinates…). It names users and pin ids, never emails.
- `server/db/postgres.js` loads `pg` only on first use. SSL: off for localhost and `*.railway.internal`, unverified for Railway's public proxy; `sslmode` is stripped from the URL so `sslFor()` alone decides.
- `DATA_STORE=dynamo|postgres` (`server/db/store.js`, default dynamo, read once at boot; the `[config]` line shows `store=`) picks the store in the barrel. **Users** have a Postgres twin (`server/schemas/pg/users.js`, PR 2): lookups ignore case and return the stored case; createUser leans on the unique indexes (`23505` → "Username/Email already registered"); reset tokens live hashed in `password_resets` (one live link per account, claimed atomically). **Pins** too (`server/schemas/pg/pins.js`, PR 3): same shapes (`coordinates {lat,lng}`, ISO times, `confirmations [{timestamp, anonymous}]`, `geoHash` derived, not stored); map boxes use the planar index from `002_pins_box_index.sql` (exactly the old lat/lng filter); the cursor is opaque base64 over `(created_at, pin_id)`, so times are written at millisecond precision; an id that isn't a UUID is "no such find", never a database error; reports and confirmations are rows (no 100-report cap). Any new function in `users.js`/`pins.js` needs its twin (contract tests check); the command center's `pg/admin.js` is the one Postgres-only module.
- Kind names are stored as typed in both stores (no `escapeHtml` on write since PR 3); emails and the share page escape their own output (`plainText` + `escapeHtml` also cleans old escaped DynamoDB rows).
- `scripts/smoke-postgres.mjs`: the real server with `DATA_STORE=postgres` over HTTP (sign-up → find → box → share page → still good → report → edit → delete). CI runs it after the build; run it against the dev database before cutover. Refuses URLs containing "prod".
- Cutover (PR 4): **runbook `docs/POSTGRES_CUTOVER.md`**. `scripts/dynamo-to-pg.mjs --load --to <host:port/db>` (check → migrate → one-transaction load via `server/db/pgLoad.js` → field-by-field verify; refuses a non-empty database without `--replace`, and `--to` must repeat the printed target); `--verify` alone compares. `WRITES_PAUSED=true` (`server/utils/writePause.js`): every `/api` write except sign-in answers 503 with the "moving to a new home" line (add a find shows it in place). Rollback: `scripts/pg-to-dynamo.mjs` (dry run; `--write` makes DynamoDB match Postgres, items shaped by `server/db/pgExport.js`), then `DATA_STORE=dynamo`.
- CI turns failed tests into annotations (`tests/reporters/annotate.mjs`), readable through the checks API when the log download isn't reachable.
- Tests: `tests/server/pgTestDb.js` gives a suite a throwaway schema with migrations applied and `DATABASE_URL` pointed at it (`TEST_MIGRATIONS_DIR` can swap in a PostGIS-free copy on a machine without PostGIS). `tests/server/pgSchema.test.js` runs against `TEST_DATABASE_URL` (CI: a `postgis/postgis` service; locally a throwaway database, never dev or prod) in a schema it drops afterwards, and skips without it.

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
- Printed surfaces: buttons filled with fig sit on a persimmon block printed off register (`box-shadow: 3px 3px 0 var(--persimmon)`, no border, 3px radius; pressed = `translate(3px, 3px)` onto the block). That covers every primary action ("add a find", sign in, "take me there", "directions", my pins, save, use my location); a toggle that is on (`.btn-active`) stays pressed onto the block. Secondary and destructive actions (cancel, delete, "still good?") are an ink outline on paper with no fill or block, and override `.btn` with a more specific selector (`.btn.cancel-notes-btn`, `.btn.delete-pin-btn`, `.popup-footer .btn.cancel-btn`). Cards (popup, Jelly panel, reset page) are paper with a 1px ink keyline, 2px radius and a fig offset shadow. A season is always a row of persimmon dots (popup band, almanac). Signed-out form fields are paper, a muted keyline, Vollkorn, left-aligned with italic placeholders.
- Map tiles are re-inked by `#ffa-duotone`, an inline SVG filter in `client/map-index.html` (tile lightness → key ink … paper), applied per tile in map.css. Keep the SVG in the HTML: Firefox hides an element whose filter points at a missing id.
- Map controls are printed like the rest: the desktop zoom is a paper card with an ink keyline and a fig offset; locate-me is a round stamp like the clusters (paper, ink ring, citron offset).
- Buttons are unstyled unless they opt in: `className="btn …"` gives the filled fig button (`.btn`, `:hover`, `:active` and the 768/480 media blocks in sidebar.css; `.btn-active` for a pressed toggle). `.btn` is a single class, so a component rule that sets the same property *after* it in the cascade wins; the old global `button:not(…)` rule (removed Oct 2026) used to override everything.

## Conventions

- React **class components** (repo convention; PinPopup/SeasonStrip are function components and that's fine). Lowercase identifiers. Prettier is installed.
- Client fetches go through `fetchWithRetry` with an `AbortController` registered on the component; always prefix with `API_BASE` (empty in prod, `http://localhost:8080` in dev).
- Sidebar ↔ Map communicate via refs from `App` **and** window CustomEvents (`ffa:pins-summary`, `ffa:nearest-good-bet`).
- Server handlers: validate input types **before** using string methods, and wrap the whole body in try/catch. An exception thrown in an async Express 4 handler is an unhandled rejection that kills the Node process.
- Pin-list failures (either store) throw `PinsQueryError` → handlers return 503 via `sendPinsError` (never an empty map).
- Users-table failures throw `UsersQueryError` (never `null`/`false`, which read as "no such user"). Messages meant for people are `UserError`; auth handlers send those as-is and answer anything else with a generic 500 (`sendAuthError`).
- Public responses must never include `submittedBy` or reports: use `toPublicPin` (pinsController.js).
- Controllers call the database through the `server/schemas/schemas.js` barrel: export new functions there (a test checks every `db.*` call; a missing `confirmPin` export broke "still good?" until Oct 2026).
- New third-party hosts the browser talks to must be added to the helmet CSP in server.js (`connectSrc`/`imgSrc`).
- Production builds content-hash every file, including the entry (`--entry-names`); `scripts/build-html.mjs` rewrites `dist/index.html` to point at them. The SW serves `.js`/`.css` cache-first, which is only safe because names change. Bump `CACHE_VERSION` in `client/sw.js` when the caching strategy or precache list changes.
- The Resend SDK returns `{ data, error }` instead of throwing. Wrap every send with `logEmailResult()` (server/utils/email.js).
- On boot the server logs `[config] … usersTable=… pinsTable=…`. Check that line first when production and local disagree.
- Add tests under `tests/server` or `tests/client` for any new util; `node:test`, no extra deps.

## Environment

`.env` (never commit): `NODE_ENV`, `JWT_SECRET` (required when NODE_ENV=production), `AWS_REGION`, `DYNAMODB_USERS_TABLE`, `PINS_TABLE`, `ALLOWED_ORIGINS`, `PORT`, `STADIA_API_KEY`. Postgres (from the move): `DATA_STORE` (`postgres` in production since Oct 25; set it in `.env` too), `WRITES_PAUSED` (cutover only), `DATABASE_URL` (in `.env`: the **dev** database's public URL, never production), `PG_POOL_MAX` (default 10), `TEST_DATABASE_URL` (tests only). Optional: `REDIS_URL`, `RESEND_API_KEY`, `APP_URL` (base for links in emails; `server/utils/appUrl.js` defaults it to https://fruitforall.app in production, localhost otherwise), `ADMIN_EMAIL`, `PIN_NOTIFICATIONS=true`.
Never print or paste `.env` values. AWS creds come from env or `~/.aws`.

## Known issues / open review items

The working checklist for the next session is `docs/HANDOFF.md`.


See the improvement review (Oct 2026). Still open:
- **Local dev:** set `DATA_STORE=postgres` in `.env` (with the dev `DATABASE_URL`). Without it, `npm run dev` still talks to the old DynamoDB tables, which production no longer reads.
- The auth forms are one component (`client/components/AuthForm.jsx`). Each `variant` keeps the DOM its layout's CSS targets (e.g. `.auth-section form`, `.guest-bar-form`), so change a variant's structure only together with its CSS.

Fixed on `fix/hotfixes` (keep these true):
- Admin is never derived from the username; reserved names are blocked case-insensitively (`validateUserName`). Edit/delete re-check `isAdmin` in the database, not just the JWT.
- Every route handler is wrapped with `wrap()` (server/utils/wrap.js); new routes must be too. Request bodies are type-checked (`validatePinInput`, `validateNotes`) before string methods run.
- "still good?" dedup uses an in-memory store when `REDIS_URL` is unset.
- Season helpers are imported in PinPopup (no `window.*` globals). Passwords are never trimmed. POSTs are never auto-retried.

## Docs

`README.md` (setup), `docs/POSTGRES_CUTOVER.md` (the move's runbook), `docs/ARCHITECTURE.md`, `docs/SECURITY.md`, `CONTRIBUTING.md`, `DYNAMODB_GSI_SETUP.md`, `non-jelly-home-implementation-map.md` (standard-mobile UI history). `.github/copilot-instructions.md` is gitignored (local only). This file is the committed equivalent.
