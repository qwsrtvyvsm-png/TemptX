// Postgres-backed replacement for the old flat-JSON-file data layer.
//
// Why a JSONB "document table" per collection instead of a fully normalized
// relational schema: every collection in this app (users, bookings,
// transactions, community posts, ...) was previously a JSON array written
// and read as a whole blob, with record shapes that still change as
// features ship (see AGENTS.md / recent commits). Normalizing all of that
// into columns today would mean guessing a schema that's likely wrong
// within a month, and a migration every time a field is added or renamed.
//
// This still gets the things a flat file never could:
//   - Atomic, crash-safe writes (a real transaction, not a file rename)
//   - Row-level storage so concurrent requests don't block on one giant file
//   - Indexing and querying via JSONB/GIN, including ad-hoc SQL for support
//     and reporting ("how many bookings today", "find this user by email")
//   - A durable, backed-up store instead of a file that can be silently
//     deleted, corrupted, or never backed up
//
// Promoting a field to its own indexed column later (e.g. users.email once
// the shape has settled) is a one-line ALTER + index — not a rewrite of
// this file or of server.js, which only ever sees whole JS objects.

const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. Add it to .env — see .env.example for the local Postgres.app default."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

pool.on("error", (error) => {
  // A connection in the idle pool died (e.g. Postgres restarted). Log it —
  // the pool recovers the next time a query acquires a client — rather than
  // letting an unhandled 'error' event crash the whole process.
  console.error("[db] unexpected error on idle Postgres client:", error);
});

// Every collection server.js used to keep as its own JSON file.
const COLLECTIONS = [
  "users",
  "reports",
  "memberships",
  "subscriptions",
  "transactions",
  "verification_events",
  "bookings",
  "client_notes",
  "community_posts",
  "community_follows",
  "community_saved",
  "community_groups",
  "community_group_members",
  "community_feedback"
];

const assertKnownTable = (table) => {
  if (!COLLECTIONS.includes(table)) {
    // Table names are never user input, but this is cheap insurance against
    // a future typo being interpolated into SQL below.
    throw new Error(`Unknown collection: "${table}"`);
  }
};

// Almost every collection's records carry their own "id" (crypto.randomUUID()).
// The two exceptions are memberships and subscriptions, which server.js has
// always treated as "one record per user" and looked up by userId rather
// than minting a separate id — so that's their natural primary key here too.
const KEY_FIELDS = {
  memberships: "userId",
  subscriptions: "userId"
};
const keyFieldFor = (table) => KEY_FIELDS[table] || "id";

const ensureSchema = async () => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const table of COLLECTIONS) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${table} (
          id TEXT PRIMARY KEY,
          data JSONB NOT NULL,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS ${table}_data_gin ON ${table} USING GIN (data);
      `);
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

const readCollection = async (table) => {
  assertKnownTable(table);
  const { rows } = await pool.query(`SELECT data FROM ${table}`);
  return rows.map((row) => row.data);
};

// Replaces the whole collection in one transaction. This mirrors the old
// "read the full array, mutate it, write the full array back" pattern used
// throughout server.js, but atomically: a crash or error mid-write rolls
// back instead of leaving a half-written file, and concurrent readers never
// see a partially-replaced collection.
const writeCollection = async (table, records) => {
  assertKnownTable(table);
  if (!Array.isArray(records)) {
    throw new Error(`writeCollection("${table}", ...) expects an array`);
  }

  const keyField = keyFieldFor(table);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`DELETE FROM ${table}`);
    for (const record of records) {
      const key = record && record[keyField];
      if (typeof key !== "string" || key === "") {
        throw new Error(`${table}: every record needs a non-empty string "${keyField}" field`);
      }
      await client.query(
        `INSERT INTO ${table} (id, data, updated_at) VALUES ($1, $2::jsonb, now())`,
        [key, JSON.stringify(record)]
      );
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  COLLECTIONS,
  ensureSchema,
  readCollection,
  writeCollection
};
