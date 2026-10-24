# Architecture

This document describes how **fruit for all** is structured at runtime. For how to set up a dev environment, see the [main README](../README.md).

## High-level flow

1. **Single Express process** ([`server.js`](../server.js)) serves the built static UI from `dist/`, plus JSON API routes under `/api/`.
2. The **React** app ([`client/index.js`](../client/index.js) → `index.html`) loads in the browser, talks to the API (same origin in production; `localhost:8080` in dev). Map code is code-split with `React.lazy`.
3. **AWS DynamoDB** holds users and pins. The Node app uses IAM credentials (env or `~/.aws`); there is no separate “BaaS” between Express and AWS.
4. **Optional Redis** (via `REDIS_URL`) backs `express-rate-limit` so multiple Node replicas share per-IP limits.
5. **Resend** sends transactional email when `RESEND_API_KEY` is set. Without it, password reset still creates a token, but the reset URL is only printed to **server logs** when Resend is off (see [`auth.js`](../server/controllers/auth.js) `forgotPassword`).

## Backend layers

| Piece | Role |
|-------|------|
| [`server.js`](../server.js) | Helmet, compression, CORS, static files, `express-rate-limit` (in-memory or Redis), route wiring. |
| [`server/controllers/index.js`](../server/controllers/index.js) | Composes the default `controllers` object. |
| [`server/controllers/auth.js`](../server/controllers/auth.js) | Register, login, `verifyToken` middleware, get user, save pins, password reset. |
| [`server/controllers/pinsController.js`](../server/controllers/pinsController.js) | Create/read/update/delete pins, IP geolocation, public and authed list endpoints. |
| [`server/schemas/users.js`](../server/schemas/users.js) | DynamoDB: users, password reset, bcrypt. |
| [`server/schemas/pins.js`](../server/schemas/pins.js) | DynamoDB: pin CRUD, `getAllPins` (bounds, GSIs). On Dynamo failure, throws `PinsQueryError` — handlers return **503** with a generic message, not an empty map. |
| [`server/schemas/schemas.js`](../server/schemas/schemas.js) | Barrel re-exports (and shared test imports). |
| [`server/utils/html.js`](../server/utils/html.js) | `escapeHtml` (email + stored content). |
| [`server/db/dynamo.js`](../server/db/dynamo.js) | `DynamoDBClient` and table name constants. |

## Data model (DynamoDB)

- **Users table** (partition key `userName`) — email, password hash, optional reset token, admin flag, etc.
- **Pins table** — partition key `pinId`, sort key `createdAt`. Global secondary indexes (see README) support querying by `status` (e.g. active pins) and by `submittedBy` (“my pins”).

`getPinById` issues a **Query** on the `pinId` partition (not a table scan).

## Public vs authenticated map reads

- **`GET /api/pins/public`** — No JWT. Returns pins with `submittedBy` stripped. Supports bounds and pagination. Rate-limited; intended for guest map loads and panning.
- **`GET /api/pins/:pinId`** — No JWT. One find for a shared link (`submittedBy` and reports stripped by `toPublicPin`). 404 when it's gone, 503 when the database is down.
- **`POST /api/pins/:pinId/report`** — No JWT. `{ reason, note? }` (`validateReport` in `client/utils/findLinks.js`). One per find per IP per day (same dedup store as "still good?") plus the `report` rate limit. Stored on the pin (`reports` list capped at 100, `reportCount`) and emailed to `ADMIN_EMAIL`; the find stays up.
- **`GET /find/:pinId`** — The app's `index.html` with that find's `<title>` and Open Graph tags (`server/utils/findPage.js` swaps the `share:start…share:end` block in `client/map-index.html`), so a pasted link previews as "fig · fruit for all". 404 (plain app) when the find is gone.
- **`GET /api/pins`** — Requires JWT. Same data access patterns, plus ETag/304 for cached clients, and can filter by user.

## Frontend structure

| Area | Files |
|------|--------|
| App shell, sidebar, auth | [`client/sidebar.jsx`](../client/sidebar.jsx) |
| Map, Leaflet, pins | [`client/map.jsx`](../client/map.jsx) |
| Client cache / auth utilities | [`client/utils/`](../client/utils/) |
| PWA | [`client/manifest.json`](../client/manifest.json), [`client/sw.js`](../client/sw.js) |

The service worker does **not** cache `/api` responses or map tiles (see `sw.js`), so map data stays fresh; static hashed chunks are cached after first load.

## Health check

- **`GET /health`** — JSON `status` and `time`. Use for load balancers; see [`server.js`](../server.js).

## Where to add features

- **New API** — Add a handler in `server/controllers/auth.js` or `pinsController.js` (or a new file + export from `index.js`), database logic in `server/schemas/`, and register the route in `server.js`.
- **New UI** — Prefer colocating with existing `sidebar` / `map` patterns; keep [`API_BASE`](../client/utils/config.js) in mind for local dev.
- **Tests** — `npm test` uses Node’s built-in runner; add files under `tests/`.

## License

GPL-3.0 — see [../LICENSE](../LICENSE). Forks must stay open source.
