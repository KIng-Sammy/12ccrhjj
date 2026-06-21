/**
 * The ordered list of targets the scraper walks through, city by city.
 *
 * Countries are swept in COUNTRY_ORDER. Within each country we walk every city
 * from that country's dataset (built from public sources):
 *   - us-cities.json — every incorporated city/town in the 50 states + D.C.
 *                      (US Census 2023 Gazetteer, FUNCSTAT=A; Hawaii/D.C. via CDP
 *                      fallback). Populations joined from GeoNames US. ~19,600.
 *   - mx-cities.json — populated places across all 32 Mexican states
 *                      (GeoNames MX dump). ~91,000. Each carries a population.
 *
 * Each record is { city, state, pop }. The workflow processes targets
 * sequentially (tracked in state/progress.json) and HARD STOPS once the final
 * target of the final country has been scraped.
 *
 * BIG CITIES (pop >= BIG_CITY_MIN) get MORE than Google's ~120-per-search cap:
 * instead of one "restaurants in X" query we run one search per category
 * (general + many cuisines). Each search returns its own batch; results are
 * merged and de-duplicated downstream, so a big city yields hundreds–thousands
 * of unique places instead of ~120.
 *
 * To queue MORE countries after Mexico, drop another <cc>-cities.json next to
 * this file and add an entry to COUNTRY_ORDER — nothing else needs to change.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Ordered country sweep. US first (every city), then Mexico. */
export const COUNTRY_ORDER = [
  { country: 'United States', file: 'us-cities.json' },
  { country: 'Mexico', file: 'mx-cities.json' },
];

/** A city counts as "big" (gets category sub-queries) at/above this population. */
export const BIG_CITY_MIN = Math.max(0, parseInt(process.env.BIG_CITY_MIN || '50000', 10) || 50000);

/**
 * Search categories used to break past Google's ~120-per-search limit in big
 * cities. The first ('restaurants') is the general sweep; the rest are cuisine /
 * type facets, each a separate search. ~20 searches → up to a few thousand
 * unique places before de-duplication.
 */
export const CATEGORIES = [
  'restaurants',
  'italian restaurants', 'chinese restaurants', 'mexican restaurants',
  'indian restaurants', 'thai restaurants', 'japanese restaurants',
  'korean restaurants', 'vietnamese restaurants', 'mediterranean restaurants',
  'pizza', 'seafood restaurants', 'steakhouse', 'barbecue restaurants',
  'burger restaurants', 'fast food', 'cafes', 'bakeries', 'bars',
  'breakfast restaurants',
];

function load(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
}

/** Flat ordered array of { city, state, country, pop }. */
export function loadTargets() {
  const all = [];
  for (const c of COUNTRY_ORDER) {
    let cities;
    try {
      cities = load(c.file);
    } catch {
      console.error(`⚠ dataset missing for ${c.country} (${c.file}) — skipping`);
      continue;
    }
    for (const r of cities) {
      all.push({ city: r.city, state: r.state || '', country: c.country, pop: r.pop || 0 });
    }
  }
  return all;
}

/** Is this target a "big" city that should get category sub-queries? */
export function isBig(t, min = BIG_CITY_MIN) {
  return (t.pop || 0) >= min;
}

function place(t) {
  return t.state ? `${t.city}, ${t.state}, ${t.country}` : `${t.city}, ${t.country}`;
}

/**
 * All Google Maps search queries for ONE city.
 *   • small city → a single "restaurants in <place>" query
 *   • big city   → one query per CATEGORY (general + cuisines), to exceed ~120
 */
export function queriesFor(t, min = BIG_CITY_MIN) {
  if (isBig(t, min)) return CATEGORIES.map(cat => `${cat} in ${place(t)}`);
  return [`restaurants in ${place(t)}`];
}

/**
 * Output files for a country. The US keeps the original names so existing leads
 * keep accumulating; every other country gets its own freshly-created pair, e.g.
 * Mexico → whatsapp-mexico.txt / gmail-mexico.txt.
 */
export function filesFor(country) {
  if (country === 'United States') {
    return { phones: 'whatsapp.txt', emails: 'gmail.txt' };
  }
  const slug = country.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return { phones: `whatsapp-${slug}.txt`, emails: `gmail-${slug}.txt` };
}
