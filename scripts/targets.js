/**
 * The ordered list of targets the scraper walks through, city by city.
 *
 * Countries are swept in COUNTRY_ORDER. Within each country we walk every city
 * from that country's dataset (built from public sources):
 *   - us-cities.json — every incorporated city/town in the 50 states + D.C.
 *                      (US Census 2023 Gazetteer, FUNCSTAT=A; Hawaii/D.C. via CDP
 *                      fallback). ~19,600 places, all 51 covered.
 *   - mx-cities.json — populated places across all 32 Mexican states
 *                      (GeoNames MX dump, class P with population or admin seat).
 *
 * The workflow processes these sequentially (tracked in state/progress.json) and
 * HARD STOPS once the final target of the final country has been scraped.
 *
 * To queue MORE countries after Mexico, drop another <cc>-cities.json next to this
 * file and add an entry to COUNTRY_ORDER — nothing else needs to change.
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

function load(file) {
  return JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
}

/** Flat ordered array of { city, state, country }. */
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
      all.push({ city: r.city, state: r.state || '', country: c.country });
    }
  }
  return all;
}

/** Build the Google Maps search query for one target. */
export function queryFor(t) {
  return t.state
    ? `restaurants in ${t.city}, ${t.state}, ${t.country}`
    : `restaurants in ${t.city}, ${t.country}`;
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
