#!/usr/bin/env node
// One-time migration: loads the existing data/*.json files into Postgres.
// Run this ONCE, after `npm install` and after DATABASE_URL is set in .env,
// and before starting the server with the new lib/db.js-backed storage.
//
//   node scripts/migrate-json-to-db.js
//
// Safe to re-run: each collection is fully replaced (same semantics as the
// app's own writeCollection calls), so running it twice just re-imports the
// same files. It does NOT delete the original data/*.json files — they're
// left in place as a backup until you've confirmed the app works against
// Postgres.

require("dotenv").config();
const fs = require("node:fs");
const path = require("node:path");
const { ensureSchema, writeCollection, COLLECTIONS } = require("../lib/db");

const dataDirectory = path.join(__dirname, "..", "data");

// Collection name -> original JSON filename.
const SOURCE_FILES = {
  users: "users.json",
  reports: "reports.json",
  memberships: "memberships.json",
  subscriptions: "subscriptions.json",
  transactions: "transactions.json",
  verification_events: "verificationEvents.json",
  bookings: "bookings.json",
  client_notes: "client-notes.json",
  community_posts: "community-posts.json",
  community_follows: "community-follows.json",
  community_saved: "community-saved.json",
  community_groups: "community-groups.json",
  community_group_members: "community-group-members.json",
  community_feedback: "community-feedback.json"
};

const main = async () => {
  console.log(`Connecting to ${process.env.DATABASE_URL || "(DATABASE_URL not set!)"}`);
  await ensureSchema();
  console.log("Schema ready. Importing collections:\n");

  for (const table of COLLECTIONS) {
    const fileName = SOURCE_FILES[table];
    const filePath = path.join(dataDirectory, fileName);

    if (!fs.existsSync(filePath)) {
      console.log(`  ${table.padEnd(26)} — no ${fileName} found, skipping`);
      continue;
    }

    const raw = fs.readFileSync(filePath, "utf8").trim();
    const records = raw ? JSON.parse(raw) : [];

    if (!Array.isArray(records)) {
      throw new Error(`${fileName} does not contain a JSON array — aborting.`);
    }

    // writeCollection() does the real validation (and knows that memberships/
    // subscriptions key on "userId" rather than "id") — just let it throw
    // with a clear message if a record is missing its key field.
    await writeCollection(table, records);
    console.log(`  ${table.padEnd(26)} — imported ${records.length} record(s) from ${fileName}`);
  }

  console.log("\nDone. The original data/*.json files were left untouched as a backup.");
  process.exit(0);
};

main().catch((error) => {
  console.error("\nMigration failed:", error);
  process.exit(1);
});
