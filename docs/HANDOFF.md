# Handoff checklist (updated Oct 19, 2026, ~3:30pm)

Read `CLAUDE.md` first. This is the to-do list for whoever picks up next.

## Start here

- Repo: `strangesongs/fruit-for-all`. `main` is live at fruitforall.app (Railway deploys on push to `main`).
- **Oct 19, ~3pm: all ten fix PRs (#13–#22) were merged into `main`** and deployed (Railway reported success for fruitforall.app on `0c4bbcb`). `main` CI passed and has 158 tests. The owner chose to merge as admin, bypassing main's 1-review rule; the protection settings are unchanged.
- `feat/wec-redesign`, `feat/medicinal-plants` and `feat/in-season` were already in `main` before that.
- Don't start the Postgres migration code before the owner approves a written plan (section 3). Planned for the evening of Oct 19.
- The owner prefers small PR-sized branches. Branch from `main`. `main` requires a passing `tests` check and 1 code-owner review (strict: up to date with main).

## 1. Merged Oct 19 (now live)

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

### Branch cleanup (owner, from a local clone)

- [ ] Delete the 15 remote branches that are fully merged into `main`. The cloud session can't delete branches (its GitHub access refuses ref deletes), so run this locally:

  ```sh
  git push origin --delete \
    chore/pin-node data/season-sources-1 \
    feat/in-season feat/medicinal-plants feat/standard-phone-layout feat/wec-redesign \
    feature/guest-access-reform \
    fix/auth-limiters fix/expired-session fix/firefox-overflow fix/locate-cache \
    fix/pin-cache fix/pin-fallback fix/popup-edit-closes fix/reset-token-url
  git fetch --prune
  ```

- [ ] Optional: turn on "Automatically delete head branches" (repo Settings → General).
- [ ] Review the 10 open Dependabot branches from Apr 28 (not merged): `@aws-sdk/client-dynamodb`, `concurrently`, `esbuild`, `jsonwebtoken`, `nodemon`, `prettier`, `redis`, `resend`, `@types/leaflet`, `uuid`. Major jumps worth a careful look: `redis` 4 → 5 and `uuid` 13 → 14.
- [ ] The owner's local folder (`~/Desktop/programming/loquat`) is still on `feat/wec-redesign`: `git checkout main && git pull`.

## 2. Check on the live site / real devices

- [ ] Firefox responsive mode at **402×874** and **240×427** with **touch simulation on**: is the bottom bar or Jelly panel cut off on the right? Is zoom off-centre? If it's still wrong, run the snippet from `docs/overflow-probe.md`.
- [ ] Real iPhone in Safari: bar, tabs, popups, add a find, sign in, editing notes, and the reset-password page.
- [ ] Real Jelly Star: FAB panel, popups. Known older issue: the popup overlaps the zoom controls.
- [ ] Railway build log shows Node 22.
- [ ] Season data: **108 of 157 entries still unverified** (status in `docs/season-sources.md`). Next batches:
  - stone fruit, apples, pears, cherries and grapes (Dave Wilson charts are images, so each needs a text source)
  - berries, nuts, mushrooms, wild greens, and the 13 leaf-harvest medicinal plants
  - zones 3–9 for everything
- [ ] `detectZoneFallback` is a rough continental-US heuristic (LA basin corrected to 10). Consider calling phzmapi by ZIP/coords and caching per area, or shipping a coarse zone grid.

### Found during the browser run, not fixed yet (both live on `main`)

- [ ] The pin popup's notes button (`.pin-notes-btn`) gets the global red button style, so an italic note renders as a solid red button. It needs adding to every copy of the `button:not(...)` rule, or the `.btn` refactor.
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
- [ ] Replace `alert()`/`confirm()` with in-app dialogs.
- [ ] Extract a shared `AuthForm` (three copies in sidebar.jsx).
- [ ] Replace the global `button:not(...)` rule (5 copies) with a `.btn` class.
- [ ] Jelly: popup overlaps the zoom controls.

Testing / CI
- [ ] Playwright width matrix in CI: 240×427, 375×667, 393×852, 1280×800. The Oct 19 review script is a starting point; it isn't in the repo yet.

## Working notes

- The cloud container can't reach registry.npmjs.org and has no Firefox. What worked on Oct 19: tar the owner's local `node_modules` (in `~/Desktop/programming/loquat`), stage it into the container, and build with the container's `esbuild` binary at `/opt/npm-tools/node_modules/@esbuild/linux-x64/bin/esbuild` (put it first on `PATH`). bcrypt ships linux-x64 prebuilds, so the server boots. Run the server with `AWS_ENDPOINT_URL_DYNAMODB=http://127.0.0.1:9` and dummy AWS keys so it can't reach production. Headless Chromium is at `/opt/pw-browsers` (Python Playwright).
- GitHub from the container: `gh api` (REST) can open and merge PRs; GraphQL commands like `gh pr list` are blocked, and deleting branches is refused.
- The tarball is still at `loquat/node_modules/.cache/ffa-review-nm.tgz` on the owner's Mac (16 MB, safe to delete).
- Git author from repo history: `j cretella <jcrtll@protonmail.com>`.
- Never print `.env` values. Ask before any irreversible data action.
