# AGENTS.md

## Cursor Cloud specific instructions

TEMPTX is a single self-contained Node.js app: `server.js` serves both the static
multi-page frontend (`*.html`/`*.js`/`*.css`) and the `/api/*` backend (auth,
directory, profiles, reports, settings). There is no framework, no build step, and
no external database. Node `>=18` is required (see `package.json` `engines`).

### Running

- Start the app with `npm start` (i.e. `node server.js`). It binds to
  `127.0.0.1:5510` only (localhost, not `0.0.0.0`); override the port with the
  `PORT` env var. The homepage is at `http://127.0.0.1:5510/`.
- There is no dev/watch server and no hot reload. After editing `server.js` you
  must restart the process for changes to take effect (static `.html/.js/.css`
  changes are picked up on browser refresh without a restart).

### Data / persistence

- State is persisted to flat JSON files under `data/` (`users.json`,
  `reports.json`, `server-secret`). This directory is gitignored and auto-created
  on first boot — you do not need to seed it. To reset all accounts/reports,
  delete `data/` and restart.

### Lint / test / build

- Lint (syntax gate): `npm run check` runs `node --check` over the JS files.
- There is no automated test suite and no build step.
- The only dependency is `puppeteer` (devDependency), used for optional design-QA
  screenshots (see `design-qa.md`); it is not needed to run the app.

### Testing the app end-to-end

- Core flow is account creation. The frontend shows an 18+ age-verification modal
  on first load that must be dismissed before the homepage is usable.
- Account roles: `client` (logs in with a generated `TX-XXXX` id + device cookie)
  and email-based `provider`/`creator`. Passwords need >=12 chars with upper,
  lower, and a number. Signup requires `acceptedPolicies: true`.
- `/api/*` POST/PATCH/DELETE endpoints enforce a same-origin CSRF check, so send
  an `Origin: http://127.0.0.1:5510` header when testing writes with curl.
