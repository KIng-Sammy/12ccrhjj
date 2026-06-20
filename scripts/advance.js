/**
 * Advance the progress pointer after a batch of cities has been scraped.
 *
 * Increments state/progress.json's index by COUNT (the batch size from
 * pick-target.js) and records what we just finished. Emits GitHub Actions
 * outputs:
 *   last            - "true" when the batch we just processed reached the END of
 *                     the final country, i.e. everything is done → HARD STOP.
 *   finishedCountry - the country the just-finished batch belonged to.
 *   newCountry      - if this batch crossed a country boundary, the next country
 *                     to start (its output files get created on the next run);
 *                     empty otherwise.
 *
 * Env:
 *   COUNT - number of targets processed this run (from pick-target.js). Default 1.
 */
import fs from 'node:fs';
import path from 'node:path';
import { loadTargets } from './targets.js';

const PROGRESS_FILE = 'state/progress.json';
const COUNT = Math.max(1, parseInt(process.env.COUNT || '1', 10) || 1);

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))?.index ?? 0;
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
const total = targets.length;

const current = readIndex();
const finishedCountry = targets[current]?.country || '';
const next = Math.min(current + COUNT, total);
const last = next >= total;

// Did we just cross from one country into the next?
const nextCountry = last ? '' : targets[next].country;
const newCountry = !last && nextCountry !== finishedCountry ? nextCountry : '';

fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
fs.writeFileSync(
  PROGRESS_FILE,
  JSON.stringify(
    {
      index: next,
      total,
      lastFinishedCountry: finishedCountry,
      lastIndexFinished: next - 1,
    },
    null,
    2
  ) + '\n'
);

console.error(
  `Advanced ${current} → ${next} / ${total} (finished ${COUNT} ${finishedCountry} cities).` +
  (newCountry ? ` ▶ Crossed into ${newCountry}.` : '') +
  (last ? ' ✔ ALL COUNTRIES DONE.' : '')
);

emit({ last: last ? 'true' : 'false', finishedCountry, newCountry });
