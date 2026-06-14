/**
 * Decide what to scrape on this run.
 *
 * Reads state/progress.json ({ "index": N }) and looks up US_STATES[N].
 * Emits GitHub Actions step outputs:
 *   done   - "true" when every state has already been processed (HARD STOP signal)
 *   index  - the current index being processed
 *   state  - the human-readable state name
 *   query  - the Google Maps search query to feed the scraper
 *
 * If state/progress.json is missing, we start at index 0.
 */
import fs from 'node:fs';
import { US_STATES, queryFor } from './us-states.js';

const PROGRESS_FILE = 'state/progress.json';

function readIndex() {
  try {
    const raw = fs.readFileSync(PROGRESS_FILE, 'utf8');
    const n = JSON.parse(raw)?.index;
    return Number.isInteger(n) && n >= 0 ? n : 0;
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
  // Always echo to the log too, for visibility / local runs.
  console.error(line);
}

const index = readIndex();

if (index >= US_STATES.length) {
  emit({ done: 'true', index, state: '', query: '' });
} else {
  const state = US_STATES[index];
  emit({
    done: 'false',
    index,
    state,
    query: queryFor(state),
  });
}
