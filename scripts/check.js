// Syntax-checks every JavaScript file the project ships: the server, lib/,
// content/, scripts/ and the browser scripts in public/. Run with: npm run check
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const SKIP = new Set(["node_modules", "data", ".git"]);

const collect = (directory) =>
  fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return collect(fullPath);
    return entry.name.endsWith(".js") ? [fullPath] : [];
  });

const files = collect(root);
let failed = 0;
for (const file of files) {
  try {
    execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
  } catch (error) {
    failed += 1;
    console.error(String(error.stderr || error.message).trim());
  }
}

console.log(`${files.length - failed} of ${files.length} files passed the syntax check.`);
process.exit(failed ? 1 : 0);
