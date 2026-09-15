# Job Portal — Where Things Stand & What's Next

_Last updated: 2026-09-14_

What this tool does (Job Portal): it watches LinkedIn and Upwork for jobs matching your saved searches (e.g. "PHP Developer" in Canada, last 24 hours), shows every run and its results in the web dashboard, and sends you a short Telegram summary whenever a run finds new jobs.

---

## 1. What's Working Now

**LinkedIn alerts work end-to-end.** A run today pulled 23–26 real "PHP Developer" jobs for Canada (past 24 hours), and the Telegram summary arrived. This was broken earlier today (the old scraping helper's free trial had expired) and has been fixed — the system now uses a different, working LinkedIn scraper, and searches actually return jobs.

**Searches follow your rules.** Keywords, country, and the time window (last 24 hours / week / month) are all respected. The scraper is told the time window directly, and results are filtered again as a safety net before anything is counted or sent.

**No more silent "0 jobs" failures.** Previously, if the scraper rejected our instructions, the run would quietly finish as "success" with zero jobs. Now that situation shows up clearly as a failed run with the scraper's actual error message, so you know something needs attention instead of wondering why nothing was found.

**You can browse every job a run found — not just the new ones.** Each run card in the dashboard has a list icon that opens a full listing page: every job that run fetched, with the new ones flagged. Clicking any job opens a detail page with the full description, salary/budget, experience level, company or client info, and a link to apply. (Runs from before today only keep the "new" jobs — they'll show a note saying so.)

**Run statuses update live.** While a run is in progress, its card shows a pulsing "running…" state, and results appear within a couple of seconds of finishing — you no longer have to hit Refresh and wait.

**Stuck "running" runs heal themselves.** If the app restarts mid-run, that run used to sit at "running" forever. Now it's automatically marked as interrupted the next time the server starts. The two runs that were stuck (one from a week ago) are closed out.

**Duplicate detection works.** The same job is never reported as "new" twice — everything already sent to Telegram is remembered and skipped in later runs.

---

## 2. Known Issues You'll Notice

**Upwork always returns 0 jobs right now.** This is not a bug in the app — the Upwork scraper's one-time free trial allowance on the Apify account is used up (its logs literally say "found 4 jobs… but no free-tier quota remains"). The trial allowance does not reset monthly, so results only come back once a payment method is added to the Apify account (see the cost breakdown above).

**The Apify account is on a free plan, and it shows.** Free plans allow only 5 scrapers running at the same time and a small monthly job/result allowance. A few runs today failed with a "concurrent runs limit" error, and some failed attempts left phantom runs behind that kept the limit blocked for a while. This will keep happening occasionally until the account is upgraded — or until runs are spaced further apart.

**The dashboard you open at localhost:8787 doesn't show the new pages yet.** The job listing and job detail pages currently exist only in the development preview. The "published" version of the site that the app serves is still an older build from Sep 7. A rebuild (one command) is needed to make the new pages appear at the main address.

**If you run the app with `npm run dev`, it can freeze mid-run.** This happened several times today: the whole dev setup stops responding for many minutes (likely a Windows console quirk), and any run in progress at that moment gets interrupted. The app now recovers cleanly on restart, but for leaving the monitor running all day, start it with `npm start` instead.

**Upwork searches are country-filtered in a way that surprises.** On Upwork, the country filter means "the client is in that country," not "the job is there." Combined with the 24-hour window, that filter usually eliminates everything. Upwork probably should search worldwide; LinkedIn should keep the country filter. That change is decided but not yet made.

**One more thing to watch:** the same search can have two schedules attached (a duplicate existed for the PHP search until today). Nothing stops you from creating another one, and duplicates mean double runs and double Telegram messages.

---

## 3. Scrapers In Use & What They Cost

Both sources run on the Apify platform, under the account's API key stored in the app's `.env` file (never printed here). Apify charges per amount of data scraped — heavier schedules cost more.

**LinkedIn — `curious_coder/linkedin-jobs-scraper`** https://apify.com/curious_coder/linkedin-jobs-scraper/pricing
- Pay-as-you-go: about **$1 per 1,000 job results** scraped; a heavier Apify subscription plan lowers that rate. A typical daily run fetching ~25 jobs costs well under a cent.
- No fixed monthly fee (Apify is retiring rentals; this actor is pure pay-per-result).
- Free-plan constraint that bites: only **5 actor runs at the same time** are allowed on the account — that's what caused the occasional "concurrent runs limit" failures.

**Upwork — `neatrat/upwork-job-scraper`** https://apify.com/neatrat/upwork-job-scraper
- Pay-as-you-go: about **$3.20 per 1,000 jobs**, and every run is billed for a **minimum of 10 jobs even if it finds none** — so an empty run still costs a little.
- Its **free trial allowance is one-time, not monthly**: roughly 10 runs and 100 results in total for non-paying accounts. This account has used it up (the logs showed jobs being found and then discarded because nothing remained). Waiting for a reset won't help — a payment method on the Apify account is required for Upwork results to come back.
- Free-trial runs count against the quota even when they return zero matching jobs.

## 4. To Do — Must

1. **Rebuild the published site** (`npm run build`) so the job listing and job detail pages appear at the normal dashboard address, not just in the dev preview.
2. **Sort out the Apify account** — add a payment method or upgrade: required for Upwork results to return (its free trial allowance is exhausted and doesn't reset) and recommended to lift the 5-at-once run limit. Until then, expect occasional failed runs and zero-job Upwork runs.
3. **Make Upwork search worldwide** (drop its country filter) while keeping country filtering for LinkedIn. Then confirm Upwork runs return jobs once the quota is available.
4. **Click-test the new pages with real data** — fire a run, open the listing from the run card, open a job's detail page, and check everything renders well in the browser. The detail data path was built today but its final click-through was interrupted.

## 5. To Do — Feature Requests 

1. **Login / signup** — add user accounts to the dashboard: a sign-up flow, a login screen, and sessions so the app is no longer wide open. Each user could eventually have their own searches, schedules, and Telegram settings.
2. **UI improvement pass** — a general polish round on the dashboard: cleaner layout and navigation, better empty states, clearer status colors, responsive layout for phone-sized screens, and consistent styling across all pages (including the newer listing/detail views).
3. **Job detail page** — build out a richer job detail experience. (A first version exists — full description, salary/budget, company/client facts, apply link — but it still needs real-data verification, polish, and possibly extras like "save/bookmark job" or a copy-link button.)

## 6. To Do — Should

- **Set expectations for empty results**: when a scraper's free quota is exhausted, the run should say "quota used up" instead of a plain "0 jobs found," so you don't wonder whether the search is wrong.
- **Warn about duplicate schedules** when attaching a second schedule to a search that already has one.
- **Stop remembering old jobs forever** — the "already sent" list grows without limit; old entries should expire after a couple of months.
- **Update the README** — it still describes the old design (CSV files to Telegram, an older database) and even contains leftover merge-conflict text.
- **Keep run storage lean** — job descriptions are stored in full for the detail page; very large runs could bloat the database over time.

## 7. Good to Know (Working as Intended)

- "Fetched" on a run card means everything the scraper returned; "new" means jobs you hadn't been told about before. The Telegram summary counts only the new ones, and runs with zero new jobs stay silent.
- If the computer/app was off when a schedule was due, the run happens shortly after startup — one catch-up run, not a pile-up.
- The dashboard currently has no login — it's meant for personal use on your own machine. Adding accounts is on the feature list above.
