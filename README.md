# Restaurant Leads Scraper

Runs [`gosom/google-maps-scraper`](https://github.com/gosom/google-maps-scraper) (MIT,
free) on **GitHub Actions** and collects restaurant leads — name, phone,
website, **email** (extracted from each site), rating, reviews, address, place id —
into outreach text files (and optionally MongoDB).

> Note: scraping Google Maps is against Google's ToS — you're choosing to do this. The
> scraper itself is open source and free. Use responsibly and at your own discretion.

## What it sweeps

It walks the world **city by city**, in order:

1. **United States — every incorporated city/town.** All 50 states + Washington, D.C.
   (~19,600 places). Source: the **US Census Bureau 2023 Gazetteer** "places" file,
   filtered to `FUNCSTAT = A` (active, functioning governments = incorporated places).
   Hawaii and D.C. have no incorporated municipalities, so their census-designated
   places are used so all 51 are covered. Built into [`scripts/us-cities.json`](scripts/us-cities.json).
2. **Mexico — every populated place.** All 32 states (~91,000 places). Source: the
   **GeoNames** Mexico dump (feature class `P`, places with a population or an
   administrative seat), sorted biggest-market-first. Built into
   [`scripts/mx-cities.json`](scripts/mx-cities.json).

The full ordered list is assembled in [`scripts/targets.js`](scripts/targets.js) and the
current position is tracked in [`state/progress.json`](state/progress.json), committed
back each run so it always picks up exactly where it left off.

> **Want more countries after Mexico?** Drop another `<cc>-cities.json` (array of
> `{ "city", "state" }`) next to the others and add one line to `COUNTRY_ORDER` in
> `scripts/targets.js`. Nothing else needs to change.

## One-time setup

1. **Create a new GitHub repo** and push these files (see commands below).
2. *(Optional)* In the repo: **Settings → Secrets and variables → Actions → New repository secret**:
   - `MONGODB_URI` — your MongoDB connection string. *Optional* — if unset, the
     MongoDB load step is skipped and you just get the text files + artifacts.
   - `MONGODB_DB` — database name. *Optional* (defaults to `chef_assist`).
3. Done. No credit card, no API key.

## How it runs (automatic)

- **Schedule:** every **5 minutes** (cron `*/5 * * * *`), the GitHub Actions minimum.
  Runs never overlap (a concurrency group queues them), so it's effectively continuous.
- **Batch per run:** each run scrapes a **batch of cities** (default **25**, set by the
  `batch` input) as multiple queries in one go — otherwise a ~110k-city sweep would take
  years at one-city-per-run. A batch never crosses a country boundary.
- **Outputs (committed each run, accumulating + de-duped):**
  - **United States** → `whatsapp.txt` (phones) and `gmail.txt` (emails).
  - **Mexico** → `whatsapp-mexico.txt` and `gmail-mexico.txt` — **created automatically**
    the first time a Mexico batch runs (i.e. once the entire US is done).
  - Each run appends a new `DAY N` section containing only the new entries it found.
- **Raw `results.json`** is attached to every run as a downloadable **artifact**.
- **HARD STOP:** once the **final city of the final country** is scraped, the workflow
  **disables itself** (`gh workflow disable`). To run again, re-enable it in the Actions
  tab and reset `state/progress.json` to `{"index": 0}`.

You can also trigger it manually from **Actions → "Scrape restaurant leads" → Run
workflow** (batch / depth / lang / email are adjustable there); the target cities are
always chosen automatically from progress.

### How long will the US take?

At 25 cities/run × ~288 runs/day, the US (~19,600 cities) finishes in roughly **3 days**
of continuous running; Mexico (~91,000) in roughly **2 weeks** more. Raise the `batch`
input to go faster (longer individual runs), lower it if runs hit the 120-minute ceiling.

## What lands in MongoDB (`leads` collection, optional)

```
{ name, phone, website, email, emails[], address, rating, reviews,
  category, placeId, cid, lat, lng, mapsUrl, query, status: 'new',
  firstSeenAt, updatedAt, scrapedAt }
```

Re-runs **upsert** (dedupe by `placeId`/`cid`), so you can run repeatedly and accumulate
leads without duplicates. Update `status` as you work each lead
(`new` → `contacted` → `won`/`lost`).

## Push these files to a new repo

```bash
cd restaurant-leads-scraper-main
git init -b main
git add -A
git commit -m "Restaurant leads scraper: city-level US → Mexico sweep via GitHub Actions"
# create an empty repo on GitHub first, then:
git remote add origin https://github.com/<you>/restaurant-leads-scraper.git
git push -u origin main
```

The scheduled workflow starts on its own within ~5 minutes of the push (a **public** repo
gets unlimited Actions minutes; private repos have a 2,000 min/month free tier).

## Regenerating the city lists

The committed `scripts/us-cities.json` / `scripts/mx-cities.json` are derived from the
public Census Gazetteer and GeoNames dumps. They rarely change, but to refresh them see
the build scripts referenced in the commit history / `data/` (Census place file +
GeoNames `MX.zip`).

## Tuning / notes

- **Blocking:** if a run comes back light, lower `depth`/`batch` and rerun — narrower
  queries beat one huge one.
- **Email extraction** visits each website, so it's much slower; set the `email` input to
  `false` for a fast phone/WhatsApp-only pass.
- The scraper image is pulled fresh each run (`gosom/google-maps-scraper`).
