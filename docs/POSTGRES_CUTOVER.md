# Postgres cutover runbook

Moving fruit for all from DynamoDB to Postgres + PostGIS on Railway. Plan: the "Postgres migration plan" doc (approved Oct 25, 2026). Data at the Oct 25 check: 11 users (10 move; `testuser` stays behind), 15 finds, 0 confirmations, 0 reports.

DynamoDB is only ever **read** by these steps, until a rollback (the last section). Never paste a database URL or password into a chat or a commit.

## 0. Once: the databases

1. Railway → the project → **New → Database → PostGIS** (or a Postgres template with PostGIS). Make two: `ffa-dev` and `ffa-production`.
2. On each, the **Variables** tab has `DATABASE_URL` (private network, `*.railway.internal`) and `DATABASE_PUBLIC_URL` (reachable from your Mac).
3. Your `.env`: `DATABASE_URL=<ffa-dev DATABASE_PUBLIC_URL>`. Don't add `DATA_STORE` yet.
4. Check: `npm run db:migrate` prints `[migrate] database <host:port/railway>`, then applies `001` and `002`.

## 1. Rehearse on dev

```sh
npm run db:check                                    # same report as Oct 25: ok
node --env-file=.env scripts/dynamo-to-pg.mjs --load --to <host:port/db as it prints it>
#  → [load] done: 10 users, 15 finds … then [verify] DynamoDB and Postgres match.
node --env-file=.env scripts/smoke-postgres.mjs     # the whole API over HTTP; cleans up after itself
```

Then use the app on dev: `DATA_STORE=postgres npm run dev` (or put `DATA_STORE=postgres` in `.env`). Sign in as yourself, check "my pins", open a shared link (`/find/<id>`), and add, edit and delete a test find. The boot line must say `store=postgres` and `postgres=<the dev host>`.

## 2. Back up DynamoDB (right before the cutover)

```sh
aws dynamodb create-backup --table-name LoquatUsers --backup-name ffa-pre-postgres-users
aws dynamodb create-backup --table-name LoquatPins  --backup-name ffa-pre-postgres-pins
```

(Use the table names from `.env` if they differ.)

## 3. Cutover (~10 minutes, late evening)

1. **Pause writes.** Railway → the app service → Variables: `WRITES_PAUSED=true` → deploy. Check the deploy log's `[config]` line ends with `writes=PAUSED`, and that adding a find on the site says "fruit for all is moving to a new home…". Browsing, shared links and signing in still work.
2. **Load production** from your Mac (with the production **public** URL just for this command, not in `.env`):

   ```sh
   DATABASE_URL='<ffa-production DATABASE_PUBLIC_URL>' node --env-file=.env scripts/dynamo-to-pg.mjs --load --to <host:port/db as it prints it>
   ```

   It must end with `[verify] DynamoDB and Postgres match.` If it doesn't, stop here: remove `WRITES_PAUSED`, redeploy, and nothing has changed.
3. **Switch.** App service Variables: `DATA_STORE=postgres`, `DATABASE_URL=${{ffa-production.DATABASE_URL}}` (Railway's reference to the private URL), delete `WRITES_PAUSED` → deploy.
4. **Check live:**
   - deploy log `[config] … store=postgres … postgres=<…railway.internal…>`, no `writes=PAUSED`
   - `/health` is ok; the map loads finds; a shared link opens its find
   - sign in, add a test find, "still good?" on it, delete it
5. Optional, so future migrations run on every deploy: app service → Settings → **Pre-deploy command** `npm run db:migrate`.

## 4. Rollback

**Within minutes, nothing written yet:** set `DATA_STORE=dynamo` (or delete it) → deploy. DynamoDB still has everything.

**After people have used it:** copy Postgres back first, then switch.

```sh
DATABASE_URL='<ffa-production DATABASE_PUBLIC_URL>' node --env-file=.env scripts/pg-to-dynamo.mjs           # dry run: lists what would change
DATABASE_URL='<ffa-production DATABASE_PUBLIC_URL>' node --env-file=.env scripts/pg-to-dynamo.mjs --write   # makes DynamoDB match
```

Then `DATA_STORE=dynamo` → deploy. Reset links sent after the cutover stop working (people can ask again).

## 5. After

- Keep the DynamoDB tables untouched for 30 days (until about late November 2026).
- Then PR 5 (`db/drop-dynamo`) removes the DynamoDB code. Delete the tables (and `testuser` with them) only with the owner's go-ahead.
- `.env`: keep `DATABASE_URL` on **dev**, never production.
