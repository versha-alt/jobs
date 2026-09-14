<<<<<<< HEAD
# Job Alert Bot — Apify Edition

Keyword-based LinkedIn & Upwork job monitoring via Apify scrapers, delivered as **CSV files to Telegram** on **scheduled triggers**.

- **Two independent source modules** — LinkedIn and Upwork, each wrapping its own Apify actor; run, schedule, or modify either without touching the other.
- **Shared downstream pipeline** — normalize → time-filter fallback → dedup → CSV → Telegram.
- **Dynamic country list** stored as data (seeded with USA, UK, Canada, New Zealand, Australia), editable at runtime.
- **Saved searches** with keywords, locations, time filter (Last 24 hours / Last week / Last month, default Last week) and free-form tags.
- **Scheduling section** — per-module triggers (Hourly / Daily / Weekly + time + day-of-week), live "next run" countdown, and a manual "Run now" action.

## Stack

| Layer     | Tech                                                        |
| --------- | ----------------------------------------------------------- |
| Backend   | Node.js ≥ 22.5, Express 4, MySQL (mysql2 pool) |
| Frontend  | React 18 + Vite + Framer Motion (animated chips, skeletons, live countdowns, toasts) |
| Scraping  | `apify-client` — calls your chosen LinkedIn / Upwork actors  |
| Delivery  | Telegram Bot API `sendMessage` — per-run text summary |
| Storage   | MySQL (`job_app` database): countries, searches, triggers, seen_jobs, runs |
| History   | `data/app.db` — pre-migration SQLite backup (read-only) |

## Setup

```powershell
npm install
npm run build        # build the web UI into dist/
npm start            # serve API + UI on http://localhost:8787
```

Development mode (hot reload):

```powershell
npm run dev          # server on :8787, Vite UI on :5173 (proxies /api)
```

### Configuration — `.env`

Copy `.env.example` to `.env` and fill in:

```ini
APIFY_TOKEN=                  # from console.apify.com → Settings → API & Integrations
APIFY_LINKEDIN_ACTOR_ID=      # e.g. bebity/linkedin-jobs-scraper
APIFY_UPWORK_ACTOR_ID=        # your preferred Upwork scraper actor
TELEGRAM_BOT_TOKEN=           # from @BotFather
TELEGRAM_CHAT_ID=             # message the bot, then check getUpdates
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=job_app
PORT=8787
```

**MySQL:** the database and tables are created automatically on first boot. To import history from a pre-migration SQLite backup, run `node scripts/migrate-sqlite-to-mysql.mjs` (idempotent — clears target tables first, then copies countries, searches, triggers, seen_jobs and runs).

**Telegram summaries:** after each successful run with at least 1 fetched job, a text summary is sent (platform, search keywords, fetched count, new-after-dedup count). Failed runs and 0-fetch runs stay silent. If Telegram is not configured, results are still stored — the run is just marked `not_configured`.

> **Note on actor inputs:** every Apify actor has its own input schema and output shape. The input builders and item parsers live in one isolated place per module — `server/modules/linkedin.js` and `server/modules/upwork.js` — so you can adapt the mapping to your chosen actor without touching the rest of the pipeline. Both modules always apply the search's time filter as a post-fetch fallback (`server/pipeline.js`) even when the actor lacks a native recency parameter.

## How a run works

1. A scheduled trigger fires (or you click **Run now**).
2. The module loads its linked search (keywords, countries, tags, time filter) and calls its Apify actor.
3. Results are normalized to the shared job format `{ title, company, location, source, url, posted_date, job_id, tags, matched_keywords }`.
4. Jobs older than the search's time window are dropped (fallback filter); seen `job_id`s are discarded via the persistent `seen_jobs` table.
5. If jobs were fetched, a Telegram text summary is sent (platform, keywords, fetched count, new count).
6. Zero-fetch runs stay silent (no message). Sent job IDs are recorded so nothing repeats.

Each module produces its own run record and its own delivery, so LinkedIn and Upwork stay distinguishable.

## API

| Endpoint                          | Description                          |
| --------------------------------- | ------------------------------------ |
| `GET/POST /api/countries`, `DELETE /api/countries/:id` | Manage the location list |
| `GET/POST /api/searches`, `PUT/DELETE /api/searches/:id` | Saved searches |
| `GET/POST /api/triggers`, `PUT/DELETE /api/triggers/:id` | Scheduled triggers (auto-computes `next_run_at`) |
| `POST /api/triggers/:id/run`      | Manual "run now" (returns `runId`)   |
| `GET /api/runs?limit=` / `GET /api/runs/:id` | Run history + job details |
| `GET /api/health`                 | Config status (Apify / Telegram)     |

## Notes

- **Start with a conservative schedule (e.g. daily)** — Apify bills per run/result volume, and trigger frequency directly drives cost.
- Countries are data, not code: add/remove in **Settings**; existing searches keep working when a country is removed.
- `seen_jobs` persists in SQLite across restarts, so dedup survives scheduled executions.
- Very large batches stay within Telegram's file limits since each module ships its own CSV per run.
=======
# jobs
>>>>>>> 7673274d44740a780cf63bf158d7c147b9a212d5
