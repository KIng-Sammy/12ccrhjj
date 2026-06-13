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

## Run it

- Repo → **Actions** tab → **“Scrape restaurant leads”** → **Run workflow**.
- Fill in:
  - **query** — e.g. `restaurants in Lagos, Nigeria` (separate several with `;`).
  - **depth** — higher = more results per query (start with `10`).
  - **lang** — `en`.
  - **email** — `true` to also pull emails from each website (slower, best for outreach).
- It scrapes, then loads everything into your MongoDB `leads` collection.
- The raw `results.json` is also attached to the run as a **downloadable artifact**
  (open it in a spreadsheet for copy-paste outreach).

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
