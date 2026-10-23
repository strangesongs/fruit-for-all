# Handoff checklist (updated Oct 23, 2026, ~1:30pm)

Read `CLAUDE.md` first. This is the to-do list for whoever picks up next.

## Start here

- Repo: `strangesongs/fruit-for-all`. `main` is live at fruitforall.app (Railway deploys on push to `main`).
- **Oct 23: #24 and #25 merged and deployed** (Railway reported success for fruitforall.app on `f9a024a`; `tests` passed). See section 0.
- **Oct 19, ~3pm: all ten fix PRs (#13–#22) were merged into `main`** and deployed (`0c4bbcb`). The owner chose to merge as admin, bypassing main's 1-review rule; the protection settings are unchanged. #24 and #25 were merged the same way at the owner's request.
- `feat/wec-redesign`, `feat/medicinal-plants` and `feat/in-season` were already in `main` before that.
- Don't start the Postgres migration code before the owner approves a written plan (section 3).
- The owner prefers small PR-sized branches. Branch from `main`. `main` requires a passing `tests` check and 1 code-owner review (strict: up to date with main).
- **Oct 23, ~1:20pm: #26 block-print redesign merged and deployed** (`113e0bd`, Railway success). Checked live in the desktop app's browser at 393×852, 240×427 and desktop. Device checks still open: section 0a.

## 0a. Merged Oct 23 (afternoon): #26 block-print redesign (now live)

**Why:** the owner felt rust/olive had become dated and dour. Measured problem too: the olive "in season" and rust "yours" rings were nearly identical for red–green colour blindness (colour difference ≈8).
**Direction:** "block print", after the Chez Panisse cookbook prints, chosen from a Claude Design canvas of 9 options ("fruit for all colour schemes" artifact: five palettes + letterpress, block print, duotone, supergraphic). The owner also liked persimmon, fig & sage and mimeograph.

What shipped (details in `CLAUDE.md` → Design system):
- Tokens in `:root` (sidebar.css): paper `#f7f1e3`, key ink `#2a2420`, fig `#5b3a5e` (accent: buttons, the month, yours), leaf `#4f6b3a` (in season), persimmon / citron / sage (colour blocks only). `--red*`, `--olive`, `--del` are aliases. Legacy hex in map.css/sidebar.css replaced with tokens. Theme colour + manifest updated.
- Pin marks print as two blocks: colour shape under the ink linework, offset 1.4 units (`BLOCKS` + `markSvg(…, { block: true })` in fruitFamilies.js, tested). In season = leaf ring + colour block; yours = solid fig disk; not in season = faded, no block. Bar "in season"/"nearest" marks use blocks; almanac marks stay plain.
- Clusters: ink ring over an offset citron disk. Popup: 40px block mark, persimmon season dots (fig ring = this month), fig "directions".
- Map: `#ffa-duotone` SVG filter (in `client/map-index.html`) re-inks the Stadia tiles warm brown on paper, per tile. A leaf-green ink was tried and rejected (competed with the in-season rings).
- Jelly (≤360px): zoom + locate hide while a popup is open (`:has()` rule in map.css). Fixes the old popup-over-zoom overlap.

Still to check on real devices:
- [ ] iPhone + Jelly Star: panning/zooming feels as smooth as before with the tile filter.
- [ ] Firefox: tiles render (the filter is referenced by id).
- [ ] Jelly Star: open a pin → zoom/locate hidden; close → they return.

Noticed on the live site, not fixed:
- [ ] Not-in-season + stale pins (opacity .5) are faint on the paler map. Consider raising stale opacity or giving quiet pins a darker ring.
- [ ] Console: Cloudflare's injected analytics beacon (`static.cloudflareinsights.com`) is blocked by the CSP. Pre-existing and harmless; either turn off Web Analytics in Cloudflare or allow the host in helmet's `scriptSrc`.

## Next: desktop as an admin "command center"

The owner (admin) is the only desktop user. Idea: a separate admin route/view rather than restyling the public sidebar. Candidate panels: recent finds and edits across all areas, stale pins to review (no "still good" in 6 months), season-data coverage (108 of 157 unverified), and the open checklist items. Plan it before building (the 768px+ tree is `.sidebar` in sidebar.jsx).

## 0. Merged Oct 23 (now live)

| PR | Branch | What | Verified how |
|---|---|---|---|
| #24 | `fix/locate-me-feedback` | Locate-me used to fail silently (iPhone with Safari location set to "never" looked like a dead button). Now: a card next to the button explains why (iPhone settings path when permission is denied), falls back to the last known location, pulses while finding, taps don't reach the map, keyboard accessible, `maximumAge` 30 s. Helper `client/utils/geolocation.js` + tests | Owner confirmed on iPhone that locate-me works once Safari location is allowed. The failure card itself is not yet seen on a device |
| #25 | `fix/popup-centering` | iPhone SE: a tall popup's top was sometimes left off-screen. `PanToPin` measured the popup before react-leaflet laid it out. Now (standard phones only) it waits two frames, measures the card, and pans by `popupPanDelta` (`client/utils/popupFit.js` + tests), with a re-check at 500 ms; bar entries bring the pin into place first | Unit tests only. **Check on the SE**: tall popups on first open after reload, and from the "in season" / "nearest" entries |

- [ ] iPhone: with Safari location denied, tap locate-me and confirm the explanation card shows and reads well (it sits left of the button).
- [ ] iPhone SE: confirm #25 (above).

### Branch cleanup (owner, from a local clone)

- [ ] Delete the remote branches that are fully merged into `main`. The cloud session can't delete branches (its GitHub access refuses ref deletes), so run this locally:

  ```sh
  git push origin --delete \
    chore/pin-node data/season-sources-1 \
    feat/in-season feat/medicinal-plants feat/standard-phone-layout feat/wec-redesign \
    feature/guest-access-reform \
    fix/auth-limiters fix/expired-session fix/firefox-overflow fix/locate-cache \
    fix/pin-cache fix/pin-fallback fix/popup-edit-closes fix/reset-token-url \
    fix/locate-me-feedback fix/popup-centering feat/block-print
  git fetch --prune
  ```

- [ ] Optional: turn on "Automatically delete head branches" (repo Settings → General).
- [ ] Review the 10 open Dependabot branches from Apr 28 (not merged): `@aws-sdk/client-dynamodb`, `concurrently`, `esbuild`, `jsonwebtoken`, `nodemon`, `prettier`, `redis`, `resend`, `@types/leaflet`, `uuid`. Major jumps worth a careful look: `redis` 4 → 5 and `uuid` 13 → 14.
- [ ] The owner's local folder (`~/Desktop/programming/loquat`) may still be on `feat/wec-redesign`: `git checkout main && git pull`.

## 1. Merged Oct 19

| PR | Branch | Verified how |
|---|---|---|
| #13 | `fix/popup-edit-closes` | Chromium: popup stays open in edit mode (it used to close; notes couldn't be edited) |
| #14 | `fix/auth-limiters` | running server: JSON 429 on the 11th bad login and the 6th reset request. Successful-login exemption untested |
| #15 | `fix/locate-cache` | running server: 429 on the 21st call. Cache unit-tested only |
| #16 | `fix/expired-session` | Chromium at 1280/375/240: signed out, public pins reloaded, form opened with the message |
| #17 | `fix/reset-token-url` | Chromium at 375/1280 |
| #18 | `chore/pin-node` | not checked: confirm Railway's build log shows Node 22 |
| #19 | `fix/pin-fallback` | Chromium: first load bounded |
| #20 | `fix/pin-cache` | Chromium: edit clears cached views, then `no-cache`; ≤30 entries |
| #21 | `fix/firefox-overflow` | Chromium only. **Unverified in Firefox** |
| #22 | `data/season-sources-1` | sources in `docs/season-sources.md` |

## 2. Check on the live site / real devices

- [ ] Firefox responsive mode at **402×874** and **240×427** with **touch simulation on**: is the bottom bar or Jelly panel cut off on the right? Is zoom off-centre? If it's still wrong, run the snippet from `docs/overflow-probe.md`.
- [ ] Real iPhone in Safari: bar, tabs, popups, add a find, sign in, editing notes, and the reset-password page.
- [ ] Real Jelly Star: FAB panel, popups (zoom/locate should hide while a popup is open).
- [ ] Railway build log shows Node 22.
- [ ] Season data: **108 of 157 entries still unverified** (status in `docs/season-sources.md`). Next batches:
  - stone fruit, apples, pears, cherries and grapes (Dave Wilson charts are images, so each needs a text source)
  - berries, nuts, mushrooms, wild greens, and the 13 leaf-harvest medicinal plants
  - zones 3–9 for everything
- [ ] `detectZoneFallback` is a rough continental-US heuristic (LA basin corrected to 10). Consider calling phzmapi by ZIP/coords and caching per area, or shipping a coarse zone grid.

### Found during the browser run, not fixed yet (both live on `main`)

- [ ] The pin popup's notes button (`.pin-notes-btn`) gets the global accent (now fig) button style, so an italic note renders as a solid fig button (visible in the owner's Oct 23 iPhone screenshot). It needs adding to every copy of the `button:not(...)` rule, or the `.btn` refactor.
- [ ] `POST /api/auth/reset-password` returns the raw server error to the browser (it showed "connect ECONNREFUSED 127.0.0.1:9" when the database was down). It should return a generic message.

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
- [x] Split the auth rate limiter (login vs register vs reset). #14
- [x] Rate-limit and cache `/api/locate` (ipapi.co). #15
- [x] Fix the "oldest 200 globally" fallback in pin loading. #19
- [ ] Review `npm audit` highs. CI runs `npm audit` (warn only); check its output on the latest `main` run.
- [x] Handle a 401 (expired JWT) by signing out cleanly instead of failing silently. #16
- [x] Remove the reset token from the URL after reading it; restyle `ResetPassword.jsx` with tokens. #17
- [ ] Resend: verify the sending domain/account (reset emails weren't arriving). Needs the owner's Resend account.
- [x] Pin the Node version (engines + Railway). #18

Client
- [x] localStorage cache eviction; bust the HTTP cache after creating a pin; fix stale notes after an edit. #20
- [x] Locate-me explains failures instead of doing nothing. #24
- [x] Pin popup fits on screen on standard phones. #25
- [x] Block-print palette + one-ink map. #26
- [ ] Replace `alert()`/`confirm()` with in-app dialogs.
- [ ] Extract a shared `AuthForm` (three copies in sidebar.jsx).
- [ ] Replace the global `button:not(...)` rule (5 copies) with a `.btn` class.
- [x] Jelly: popup overlaps the zoom controls. Controls hide while a popup is open (#26).

Testing / CI
- [ ] Playwright width matrix in CI: 240×427, 375×667, 393×852, 1280×800. The Oct 19 review script is a starting point; it isn't in the repo yet.

## Working notes

- The cloud container can't reach registry.npmjs.org, fruitforall.app, or WebKit/Firefox. What worked on Oct 19: tar the owner's local `node_modules` (in `~/Desktop/programming/loquat`), stage it into the container, and build with the container's `esbuild` binary at `/opt/npm-tools/node_modules/@esbuild/linux-x64/bin/esbuild` (put it first on `PATH`). bcrypt ships linux-x64 prebuilds, so the server boots. Run the server with `AWS_ENDPOINT_URL_DYNAMODB=http://127.0.0.1:9` and dummy AWS keys so it can't reach production. Headless Chromium is at `/opt/pw-browsers` (Python Playwright). Without `node_modules`, `node --test tests/client/*.test.js` still runs and the esbuild binary can syntax-check a `.jsx` file.
- GitHub from the container: `gh api` (REST) can open and merge PRs; GraphQL commands like `gh pr list` are blocked, and deleting branches is refused. The clone is shallow and single-branch; after pushing a new branch, add a fetch refspec for it so git sees the upstream.
- The tarball is still at `loquat/node_modules/.cache/ffa-review-nm.tgz` on the owner's Mac (16 MB, safe to delete).
- Git author from repo history: `j cretella <jcrtll@protonmail.com>`.
- Claude Design canvas with the colour-scheme options: "fruit for all colour schemes" in the owner's claude.ai artifacts.
- From a cloud session, the desktop app's built-in browser can open fruitforall.app (Stadia tiles load there, not in the container). Injecting CSS/JS into the live page is a quick way to preview UI changes on real tiles before merging.
- Never print `.env` values. Ask before any irreversible data action.