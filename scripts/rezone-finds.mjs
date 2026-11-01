#!/usr/bin/env node
// One-off: give every saved find the zone the 2023 USDA map has for its spot
// (server/data/zip-zones.csv via server/schemas/zone.js). Until Nov 2026 zones
// came from a rough estimate, because the phzmapi.com lookup never answered.
//
//   node --env-file=.env scripts/rezone-finds.mjs                         dry run: prints the plan, writes nothing
//   node --env-file=.env scripts/rezone-finds.mjs --write --to <host:port/db>
//   node --env-file=.env scripts/rezone-finds.mjs --undo rezone-undo-<time>.json --to <host:port/db>
//
// --write  changes only the `zone` column (not updated_at: nobody edited the find),
//          in one transaction, and only where the zone is still what the plan read.
//          First it saves rezone-undo-<time>.json (pin id → old zone) in this folder.
// --to     must repeat the target exactly as the script prints it, so a write
//          can't go to the wrong database by accident.
import { writeFileSync, readFileSync } from 'node:fs';
import { describeDatabaseUrl, getPool, closePool } from '../server/db/postgres.js';
import { planRezone } from '../server/db/rezone.js';

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const valueOf = (f) => {
  const i = argv.indexOf(f);
  return i >= 0 ? argv[i + 1] : undefined;
};

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set.');
  process.exit(1);
}
const target = describeDatabaseUrl(url);
console.log(`[rezone] database ${target}`);
const writing = has('--write') || has('--undo');
if (writing && valueOf('--to') !== target) {
  console.error(`[rezone] to write, repeat the target:\n  node scripts/rezone-finds.mjs ${has('--undo') ? `--undo ${valueOf('--undo')}` : '--write'} --to ${target}`);
  process.exit(2);
}

try {
  const pool = await getPool();
  if (has('--undo')) {
    const undo = JSON.parse(readFileSync(valueOf('--undo'), 'utf8'));
    const client = await pool.connect();
    try {
      await client.query('begin');
      for (const u of undo.changes) {
        await client.query('update pins set zone = $2 where pin_id = $1 and zone is not distinct from $3', [u.pinId, u.from, u.to]);
      }
      await client.query('commit');
      console.log(`[rezone] put back ${undo.changes.length} zones from ${valueOf('--undo')}`);
    } catch (err) {
      await client.query('rollback');
      throw err;
    } finally {
      client.release();
    }
  } else {
    const { rows } = await pool.query(
      `select pin_id, fruit_type, zone, st_y(location::geometry) as lat, st_x(location::geometry) as lng
         from pins order by created_at`,
    );
    const { changes, same, unknown } = planRezone(rows);
    console.log(`[rezone] ${rows.length} finds: ${changes.length} to change, ${same} already right, ${unknown.length} with no ZIP centre within range (left alone)`);
    for (const c of changes) {
      console.log(`  ${c.pinId}  ${String(c.kind).padEnd(16)}  zone ${c.from ?? '–'} → ${c.to} (${c.subzone}, ZIP centre ${c.km} km away)`);
    }
    for (const u of unknown) console.log(`  ${u.pinId}  ${String(u.kind).padEnd(16)}  zone ${u.from ?? '–'}: no ZIP centre nearby, unchanged`);

    if (!has('--write')) {
      console.log(changes.length ? `[rezone] dry run. To apply, run:\n  node scripts/rezone-finds.mjs --write --to ${target}` : '[rezone] nothing to do');
    } else if (changes.length) {
      const undoFile = `rezone-undo-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
      writeFileSync(undoFile, JSON.stringify({ database: target, at: new Date().toISOString(), changes }, null, 2));
      console.log(`[rezone] old zones saved to ${undoFile}`);
      const client = await pool.connect();
      try {
        await client.query('begin');
        let n = 0;
        for (const c of changes) {
          const r = await client.query('update pins set zone = $2 where pin_id = $1 and zone is not distinct from $3', [c.pinId, c.to, c.from]);
          n += r.rowCount;
        }
        await client.query('commit');
        console.log(`[rezone] done: ${n} of ${changes.length} changed${n < changes.length ? ' (the rest changed since the plan was read)' : ''}`);
      } catch (err) {
        await client.query('rollback');
        throw err;
      } finally {
        client.release();
      }
    }
  }
} catch (err) {
  console.error(`[rezone] ${err.message}`);
  process.exitCode = 1;
} finally {
  await closePool();
}
