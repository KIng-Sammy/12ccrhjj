/**
 * Decide what to scrape on this run (city-level walk).
 *
 * Reads state/progress.json ({ "index": N }) and takes a BATCH of targets
 * starting at N from the flat US→Mexico list (scripts/targets.js). Because there
 * are ~110k cities, scraping one-per-run would take years; we feed several
 * cities per run as multiple queries. The batch is CLAMPED to a single country
 * so the output files for the run are unambiguous.
 *
 * Writes queries.txt (one query per line) and emits GitHub Actions outputs:
 *   done        - "true" when every target has been processed (HARD STOP signal)
 *   index       - start index of this batch
 *   count       - how many targets are in this batch
 *   country     - the country this batch belongs to
 *   phonesFile  - output file for phone numbers this run
 *   emailsFile  - output file for emails this run
 *   label       - short human label for logs / artifact naming
 *
 * Env:
 *   BATCH - how many cities to scrape per run (default 25)
 *
 * If state/progress.json is missing, we start at index 0.
 */
import fs from 'node:fs';
import { loadTargets, queryFor, filesFor } from './targets.js';

const PROGRESS_FILE = 'state/progress.json';
const QUERIES_FILE = 'queries.txt';
const BATCH = Math.max(1, parseInt(process.env.BATCH || '25', 10) || 25);

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

// Take up to BATCH targets, but stop at a country boundary so the run writes to
// exactly one country's output files.
const country = targets[index].country;
const batch = [];
for (let i = index; i < targets.length && batch.length < BATCH; i++) {
  if (targets[i].country !== country) break;
  batch.push(targets[i]);
}

fs.writeFileSync(QUERIES_FILE, batch.map(queryFor).join('\n') + '\n');

const { phones, emails } = filesFor(country);
const first = batch[0];
const last = batch[batch.length - 1];
const label = `${country}-${index}-${index + batch.length - 1}`;

emit({
  done: 'false',
  index,
  count: batch.length,
  country,
  phonesFile: phones,
  emailsFile: emails,
  label,
});

console.error(
  `Batch: ${batch.length} ${country} cities, idx ${index}..${index + batch.length - 1} ` +
  `(${first.city}, ${first.state} → ${last.city}, ${last.state}) of ${targets.length} total`
);
