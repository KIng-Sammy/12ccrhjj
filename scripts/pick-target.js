/**
 * Decide what to scrape on this run and write a per-city PLAN to batch.json.
 *
 * Reads state/progress.json ({ "index": N }) and assembles the next unit of work
 * from the flat US→Mexico list (scripts/targets.js):
 *
 *   • If targets[N] is a BIG city (pop >= BIG_CITY_MIN), the run handles JUST
 *     that one city — but with its full set of category sub-queries (general +
 *     cuisines) so it blows past Google's ~120-per-search cap. One big city per
 *     run keeps the run under the 2-hour ceiling.
 *   • Otherwise the run packs a batch of consecutive SMALL cities (up to BATCH),
 *     each with its single "restaurants in <city>" query. The batch stops at a
 *     country boundary or the first big city so a run is always one country and
 *     never mixes big+small.
 *
 * batch.json shape:
 *   {
 *     country, phones, emails,
 *     cities: [ { index, city, state, pop, big, queries: [...] }, ... ]
 *   }
 *
 * Emits GitHub Actions outputs: done, index, count (cities), country,
 * phonesFile, emailsFile, label.
 *
 * Env: BATCH (small-city cities per run, default 15), BIG_CITY_MIN (default 50000).
 */
import fs from 'node:fs';
import { loadTargets, queriesFor, filesFor, isBig } from './targets.js';

const PROGRESS_FILE = 'state/progress.json';
const BATCH_FILE = 'batch.json';
const BATCH = Math.max(1, parseInt(process.env.BATCH || '15', 10) || 15);

function readIndex() {
  try {
    const n = JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))?.index;
    return Number.isInteger(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function emit(pairs) {
  const out = process.env.GITHUB_OUTPUT;
  const line = Object.entries(pairs).map(([k, v]) => `${k}=${v}`).join('\n');
  if (out) fs.appendFileSync(out, line + '\n');
  console.error(line);
}

const targets = loadTargets();
const index = readIndex();

if (index >= targets.length) {
  emit({ done: 'true', index, count: 0, country: '', phonesFile: '', emailsFile: '', label: '' });
  process.exit(0);
}

const country = targets[index].country;
const cities = [];

if (isBig(targets[index])) {
  // Big city → its own run with all category sub-queries.
  cities.push(index);
} else {
  // Pack consecutive small cities, same country, stop before any big city.
  for (let i = index; i < targets.length && cities.length < BATCH; i++) {
    if (targets[i].country !== country) break;
    if (isBig(targets[i])) break;
    cities.push(i);
  }
}

const files = filesFor(country);
const plan = {
  country,
  phones: files.phones,
  emails: files.emails,
  cities: cities.map(i => {
    const t = targets[i];
    return {
      index: i,
      city: t.city,
      state: t.state,
      pop: t.pop,
      big: isBig(t),
      queries: queriesFor(t),
    };
  }),
};

fs.writeFileSync(BATCH_FILE, JSON.stringify(plan, null, 2) + '\n');

const totalQueries = plan.cities.reduce((n, c) => n + c.queries.length, 0);
const first = targets[cities[0]];
const last = targets[cities[cities.length - 1]];
const label = `${country}-${index}-${index + cities.length - 1}`;

emit({
  done: 'false',
  index,
  count: cities.length,
  country,
  phonesFile: plan.phones,
  emailsFile: plan.emails,
  label,
});

console.error(
  `Plan: ${cities.length} ${country} ${cities.length === 1 && plan.cities[0].big ? 'BIG ' : ''}` +
  `cit${cities.length === 1 ? 'y' : 'ies'}, ${totalQueries} quer${totalQueries === 1 ? 'y' : 'ies'}, ` +
  `idx ${index}..${index + cities.length - 1} ` +
  `(${first.city}, ${first.state} → ${last.city}, ${last.state}) of ${targets.length} total`
);
