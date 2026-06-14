/**
 * Split scraped results into two outreach files:
 *   whatsapp.txt - one phone / WhatsApp number per line
 *   gmail.txt    - one email address per line
 *
 * Both files accumulate across runs (one state per run) and are de-duplicated, so
 * the final files hold every unique number / email gathered across the whole
 * United States. New entries are appended; existing entries are never duplicated.
 *
 * Usage: node scripts/extract.js out/results.json
 */
import fs from 'node:fs';

const file = process.argv[2] || 'out/results.json';
const WHATSAPP_FILE = 'whatsapp.txt';
const GMAIL_FILE = 'gmail.txt';

/** The scraper may emit a JSON array OR newline-delimited JSON. Handle both. */
function parseResults(raw) {
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return text
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }
}

/** Load an existing line-per-entry file into a Set (preserves what we already have). */
function loadExisting(path) {
  try {
    return new Set(
      fs
        .readFileSync(path, 'utf8')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean)
    );
  } catch {
    return new Set();
  }
}

if (!fs.existsSync(file)) {
  console.error(`No results file at ${file} — nothing to extract.`);
  process.exit(0);
}

const rows = parseResults(fs.readFileSync(file, 'utf8'));

const phones = loadExisting(WHATSAPP_FILE);
const emails = loadExisting(GMAIL_FILE);
let newPhones = 0;
let newEmails = 0;

for (const r of rows) {
  const phone = (r.phone || '').toString().trim();
  if (phone && !phones.has(phone)) {
    phones.add(phone);
    newPhones += 1;
  }

  const list = Array.isArray(r.emails) ? r.emails : r.email ? [r.email] : [];
  for (const e of list) {
    const email = (e || '').toString().trim().toLowerCase();
    if (email && !emails.has(email)) {
      emails.add(email);
      newEmails += 1;
    }
  }
}

// Write back, sorted for stable diffs.
fs.writeFileSync(WHATSAPP_FILE, [...phones].sort().join('\n') + '\n');
fs.writeFileSync(GMAIL_FILE, [...emails].sort().join('\n') + '\n');

console.error(
  `Extracted ${rows.length} rows → +${newPhones} new phones (${phones.size} total in ${WHATSAPP_FILE}), ` +
    `+${newEmails} new emails (${emails.size} total in ${GMAIL_FILE}).`
);
