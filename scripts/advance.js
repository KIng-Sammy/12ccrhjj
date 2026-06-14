/**
 * Advance the progress pointer after a state has been scraped.
 *
 * Increments state/progress.json's index by one and records the state we just
 * finished. Emits the GitHub Actions step output:
 *   last - "true" when the state we just processed was the FINAL one, i.e. the
 *          whole United States is done and the workflow should HARD STOP.
 */
import fs from 'node:fs';
import path from 'node:path';
import { US_STATES } from './us-states.js';

const PROGRESS_FILE = 'state/progress.json';

function readIndex() {
  try {
    return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'))?.index ?? 0;
  } catch {
    return 0;
  }
}

function emit(pairs) {
  const out = process.env.GITHUB_OUTPUT;
  const line = Object.entries(pairs)
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');
  if (out) fs.appendFileSync(out, line + '\n');
  console.error(line);
}

const current = readIndex();
const finished = US_STATES[current] || '';
const next = current + 1;
const last = next >= US_STATES.length;

fs.mkdirSync(path.dirname(PROGRESS_FILE), { recursive: true });
fs.writeFileSync(
  PROGRESS_FILE,
  JSON.stringify(
    {
      index: next,
      total: US_STATES.length,
      lastFinished: finished,
    },
    null,
    2
  ) + '\n'
);

console.error(`Finished "${finished}" (index ${current}). Next index: ${next}/${US_STATES.length}.`);
emit({ last: last ? 'true' : 'false', finished });
