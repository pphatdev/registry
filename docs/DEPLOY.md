# Deploying the Telemetry Backend

The `server/` directory holds a Cloudflare Worker + D1 backend that receives events from the CLI and answers `pphat stats --remote` queries. This guide walks through deploying it from scratch.

- **Runtime** — Cloudflare Workers (edge, no cold starts).
- **Storage** — Cloudflare D1 (SQLite at the edge).
- **Auth** — bearer token for admin `DELETE`; ingest is unauthenticated but rate-limited per IP.
- **Cost** — free tier covers ~100k requests/day and 5 GB of D1 storage.

---

## 1. Prerequisites

- A Cloudflare account.
- Node.js 18+.
- The bundled `wrangler` CLI (installed by `npm install` under `server/`).

```bash
cd server
npm install
```

Then authenticate with Cloudflare. Two options:

**A) API token (recommended for CI / already-configured machines):**

```bash
export CLOUDFLARE_API_TOKEN="…create at https://dash.cloudflare.com/profile/api-tokens…"
npx wrangler whoami   # should print your account
```

Skip `wrangler login` — the token *is* the auth.

**B) OAuth (interactive browser login):**

```bash
npx wrangler login
```

If OAuth errors with `You are logged in with an API Token. Unset the CLOUDFLARE_API_TOKEN…`, pick one method — either use the API token as-is (option A) or `unset CLOUDFLARE_API_TOKEN` before running `wrangler login`.

---

## 2. Create the D1 database

```bash
cd server
npm run db:create
```

`wrangler` prints something like:

```
✅ Successfully created DB 'pphat-telemetry'
database_id = "5c9a3f2b-...."
```

Open `server/wrangler.toml` and paste that id in place of `REPLACE_WITH_YOUR_D1_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "pphat-telemetry"
database_id = "5c9a3f2b-...."
migrations_dir = "migrations"
```

Apply migrations to bring the database up to date:

```bash
npm run db:migrate            # remote (production)
npm run db:migrate:local      # local D1 file used by `npm run dev`
```

Wrangler tracks applied migrations in a `d1_migrations` table on the database itself, so re-running is idempotent — only pending files under `server/migrations/` get applied.

### Adding a new migration later

```bash
cd server
npm run db:migrate:new add_user_agent_column
# → creates server/migrations/0001_add_user_agent_column.sql
```

Edit the generated SQL file, then apply it with `npm run db:migrate` (or let the release workflow do it — see step 4). List applied/pending with `npm run db:migrate:list`.

### One-time reset (pre-launch only)

If a database was seeded with a hand-run `schema.sql` before migrations were introduced and now can't accept the migrations cleanly, drop the tables and re-migrate:

```bash
cd server
npx wrangler d1 execute pphat-telemetry --remote --command \
  "DROP TABLE IF EXISTS event_names; DROP TABLE IF EXISTS events; DROP TABLE IF EXISTS d1_migrations;"
npm run db:migrate
```

**Never do this once you have real user data** — it wipes everything.

---

## 3. Set the admin token

Pick a long random string — this is what protects `DELETE /` (used by `pphat stats --reset-remote`).

```bash
npx wrangler secret put ADMIN_TOKEN
# paste your token when prompted
```

Store the same value in your password manager. Users who run `pphat stats --reset-remote` will need it as `PPHAT_ADMIN_TOKEN`.

---

## 4. Deploy

```bash
npm run deploy
```

`wrangler` prints your Worker URL, e.g. `https://pphat-telemetry.<your-subdomain>.workers.dev`. Verify it:

```bash
curl https://pphat-telemetry.<your-subdomain>.workers.dev/health
# → {"status":"ok","db":"ok"}
```

---

## 5. Point the CLI at the endpoint

Two options:

**Per-user (env var)** — no CLI code change:

```bash
export PPHAT_TELEMETRY_ENDPOINT="https://pphat-telemetry.<your-subdomain>.workers.dev"
```

**Baked into the published CLI** — edit `src/core/telemetry.ts`:

```ts
const DEFAULT_REMOTE_ENDPOINT = 'https://pphat-telemetry.<your-subdomain>.workers.dev';
```

Then `npm run build && npm publish`. All installs pick up the endpoint automatically.

---

## 6. Verify the round-trip

Run a couple of CLI commands, then query the aggregate:

```bash
pphat add-icon react vue github
pphat stats --top-icons --remote
# Top icons — all users:
#   react   1
#   vue     1
#   github  1
```

Local personal stats keep working the same:

```bash
pphat stats --top-icons
```

---

## 7. Local development

For iterating on the Worker without deploying:

```bash
cd server
cp .dev.vars.example .dev.vars    # then set ADMIN_TOKEN inside
npm run db:migrate:local           # applies schema to a local D1 file
npm run dev                        # http://localhost:8787
```

Point the CLI at localhost while testing:

```bash
export PPHAT_TELEMETRY_ENDPOINT=http://localhost:8787
```

---

## 8. Admin operations

Wipe the aggregate store from any machine that has the token:

```bash
export PPHAT_ADMIN_TOKEN="…the secret you set in step 3…"
pphat stats --reset-remote
```

The CLI prompts for confirmation. Pass `-y` to skip in scripted contexts.

---

## 9. Rate limits

Configured in `server/wrangler.toml`:

| Endpoint | Limit | Key |
|---|---|---|
| `POST /` (ingest) | 60 / min | client IP |
| `GET /popular` | 30 / min | client IP |
| `DELETE /` (admin) | unlimited | — |
| `GET /health` | unlimited | — |

Tune `simple = { limit, period }` under the corresponding binding. If CI/NAT'd IPs get throttled, switch the ingest key to `${ip}:${anon_id}` inside `server/src/index.ts` (`clientKey` → `checkLimit`) so the ceiling applies per pseudonymous user instead of per IP.

---

## 10. Monitoring

- **Health** — `GET /health` runs a `SELECT 1` against D1. Point uptime checks here.
- **Logs** — `npx wrangler tail` in `server/` streams live requests.
- **D1 usage** — Cloudflare dashboard → Workers & Pages → D1 → your database.

---

## 11. Retention

Every run is stored forever by default. To keep the database small, add a Cron Trigger that rolls up daily counts and prunes raw rows past N days. Suggested when `events` crosses ~1M rows.
