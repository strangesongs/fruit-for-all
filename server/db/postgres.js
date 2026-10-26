/**
 * The Postgres connection: one pool for the whole process, made on first use so
 * nothing connects (or even loads `pg`) while DATA_STORE is still `dynamo`.
 *
 * DATABASE_URL: Railway's internal URL in production; its public proxy URL in a
 * developer's .env (the dev database, never production).
 */

/** Host, port and database name for the [config] boot line. Never the user or password. */
export function describeDatabaseUrl(url) {
  if (!url) return '(unset)';
  try {
    const u = new URL(url);
    const db = u.pathname.replace(/^\//, '') || '(default)';
    return `${u.hostname}${u.port ? `:${u.port}` : ''}/${db}`;
  } catch {
    return '(unparseable)';
  }
}

/**
 * SSL for the pool. Railway's internal network (*.railway.internal) and localhost
 * don't use it; its public proxy does, with a certificate pg can't verify.
 * `?sslmode=disable` / `require` in the URL wins.
 */
export function sslFor(url) {
  if (!url) return false;
  let u;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  const mode = u.searchParams.get('sslmode');
  if (mode === 'disable') return false;
  if (mode === 'require' || mode === 'no-verify') return { rejectUnauthorized: false };
  if (mode === 'verify-full' || mode === 'verify-ca') return true;
  const host = u.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.railway.internal')) {
    return false;
  }
  return { rejectUnauthorized: false };
}

/**
 * The URL without sslmode: pg lets the URL's sslmode override the `ssl` option
 * (and reads `require` as verify-full), so sslFor() alone decides.
 */
export function withoutSslMode(url) {
  try {
    const u = new URL(url);
    u.searchParams.delete('sslmode');
    return u.toString();
  } catch {
    return url;
  }
}

let poolPromise = null;

/** The shared pg.Pool. Throws if DATABASE_URL is unset. */
export function getPool() {
  if (!poolPromise) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('DATABASE_URL is not set');
    poolPromise = import('pg').then(({ default: pg }) => {
      const pool = new pg.Pool({
        connectionString: withoutSslMode(url),
        ssl: sslFor(url),
        max: Number.parseInt(process.env.PG_POOL_MAX || '10', 10),
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000,
      });
      // An idle client losing its connection must not crash the process.
      pool.on('error', (err) => console.error('[postgres] idle client error:', err.message));
      return pool;
    });
  }
  return poolPromise;
}

/** pool.query, for one-statement work. */
export async function query(text, params) {
  const pool = await getPool();
  return pool.query(text, params);
}

/** Runs `fn(client)` in a transaction; rolls back if it throws. */
export async function withTransaction(fn) {
  const pool = await getPool();
  const client = await pool.connect();
  try {
    await client.query('begin');
    const result = await fn(client);
    await client.query('commit');
    return result;
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (!poolPromise) return;
  const pool = await poolPromise;
  poolPromise = null;
  await pool.end();
}
