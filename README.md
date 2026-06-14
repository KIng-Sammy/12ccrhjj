# Restaurant Leads Scraper

Runs [`gosom/google-maps-scraper`](https://github.com/gosom/google-maps-scraper) (MIT,
free) on **GitHub Actions** and upserts the results into **MongoDB** — name, phone,
website, **email** (extracted from each site), rating, reviews, address, place id.

> Note: scraping Google Maps is against Google's ToS — you're choosing to do this. The
> scraper itself is open source and free. Use responsibly and at your own discretion.

## One-time setup

1. **Create a new GitHub repo** and push these files (see commands below).
2. In the repo: **Settings → Secrets and variables → Actions → New repository secret**:
   - `MONGODB_URI` — your MongoDB connection string (e.g. your Atlas URI). **Required.**
   - `MONGODB_DB` — database name. *Optional* (defaults to `chef_assist`).
3. Done. No credit card, no API key.

## Run it (automatic — walks the United States)

This is now wired to sweep the **United States one state at a time**, automatically.

- **Schedule:** runs **3× per day** (cron `13 5,13,21 * * *`, UTC). No clicks needed.
- **Targets:** every run scrapes the next state — `restaurants in <State>, United States`
  — using the ordered list in [`scripts/us-states.js`](scripts/us-states.js)
  (50 states + Washington, D.C.). Progress is tracked in
  [`state/progress.json`](state/progress.json) and committed back each run, so it
  picks up exactly where it left off.
- **Outputs (committed to the repo each run, accumulating + de-duped):**
  - **`whatsapp.txt`** — one phone / WhatsApp number per line.
  - **`gmail.txt`** — one email address per line.
- **MongoDB load is optional now** — it only runs if you set the `MONGODB_URI`
  secret; otherwise it's skipped. The raw `results.json` is still attached to each
  run as a **downloadable artifact**.
- **HARD STOP:** once the **final state** is scraped, the workflow **disables itself**
  (via `gh workflow disable`) so it stops running. To run it again, re-enable it in
  the Actions tab and reset `state/progress.json` back to `{"index": 0}`.

You can still trigger it manually from **Actions → “Scrape restaurant leads” → Run
workflow** (depth / lang / email are adjustable there); the target state is always
chosen automatically from progress.

## What lands in MongoDB (`leads` collection)

```
{ name, phone, website, email, emails[], address, rating, reviews,
  category, placeId, cid, lat, lng, mapsUrl, query, status: 'new',
  firstSeenAt, updatedAt, scrapedAt }
```

Re-runs **upsert** (dedupe by `placeId`/`cid`), so you can run it repeatedly and
accumulate leads without duplicates. Update `status` as you work each lead
(`new` → `contacted` → `won`/`lost`).

## Push these files to a new repo

```bash
cd restaurant-leads-scraper
git init -b main
git add -A
git commit -m "Restaurant leads scraper → MongoDB via GitHub Actions"
# create an empty repo on GitHub first, then:
git remote add origin https://github.com/<you>/restaurant-leads-scraper.git
git push -u origin main
```

## Tuning / notes

- **Blocking:** if a run comes back light, lower concurrency / rerun, or split big
  areas into smaller queries (per district) — more, narrower queries beat one huge one.
- **Email extraction** visits each website, so it’s much slower; turn it off for a fast
  phone/WhatsApp-only pass.
- **Cost:** GitHub Actions minutes are free for public repos and have a generous free
  tier for private ones.
- The scraper image is pulled fresh each run (`gosom/google-maps-scraper`).
