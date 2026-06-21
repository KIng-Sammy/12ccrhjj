/**
 * Split scraped results into two outreach files:
 *   whatsapp.txt  — phone numbers, organized by run  (DAY 1, DAY 2, …)
 *   gmail.txt     — email addresses, organized by run (DAY 1, DAY 2, …)
 *
 * Each time this script runs it appends a new "DAY N" section with only the
 * NEW entries found in that run. Entries already present in the file (from any
 * prior day) are silently skipped — no duplicates across days.
 *
 * Email filters (entries that fail any check are dropped):
 *   ✗ longer than 32 characters
 *   ✗ ends with .png / .jpg / .jpeg / .gif / .webp / .svg / .bmp / .ico
 *   ✗ does not contain exactly one "@" with a domain after it
 *
 * Phone filters:
 *   ✗ fewer than 7 digits after stripping non-numeric characters
 *
 * Usage: node scripts/extract.js out/results.json
 */
import fs from 'node:fs';

const file = process.argv[2] || 'out/results.json';
// Per-country output files, chosen by pick-target.js via filesFor(country) and
// passed in through the environment. Defaults keep the original US filenames.
const WHATSAPP_FILE = process.env.PHONES_FILE || 'whatsapp.txt';
const GMAIL_FILE    = process.env.EMAILS_FILE || 'gmail.txt';

// ── Parsers ──────────────────────────────────────────────────────────────────

/** Handle both JSON-array and newline-delimited JSON output from the scraper. */
function parseResults(raw) {
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    return text
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean)
      .map(l => { try { return JSON.parse(l); } catch { return null; } })
      .filter(Boolean);
  }
}

/**
 * Parse a DAY-organised outreach file.
 * Returns:
 *   dayCount   — highest DAY number seen (0 if file is new / has no DAY lines)
 *   allEntries — Set of every non-header line (used for deduplication)
 *
 * Migration: old flat-sorted files have no "DAY N" lines, so dayCount → 0
 * and every existing entry lands in allEntries, preventing duplicates.
 */
function parseDayFile(path) {
  let dayCount = 0;
  const allEntries = new Set();
  try {
    for (const line of fs.readFileSync(path, 'utf8').split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const m = t.match(/^DAY\s+(\d+)$/i);
      if (m) {
        dayCount = Math.max(dayCount, parseInt(m[1], 10));
      } else {
        allEntries.add(t);
      }
    }
  } catch {
    // file doesn't exist yet — that's fine
  }
  return { dayCount, allEntries };
}

// ── Validators ───────────────────────────────────────────────────────────────

const IMAGE_EXTS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'];
const EMAIL_RE   = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/;

function isValidEmail(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const e = raw.trim().toLowerCase();
  if (e.length < 6 || e.length > 32)            return false;  // too short or > 32 chars
  if (IMAGE_EXTS.some(ext => e.endsWith(ext)))   return false;  // ends with image ext
  if (!EMAIL_RE.test(e))                          return false;  // fails format check
  return true;
}

function isValidPhone(raw) {
  if (!raw || typeof raw !== 'string') return false;
  const digits = raw.replace(/\D/g, '');
  return digits.length >= 7;  // at least 7 numeric digits
}

/**
 * PROJECT-WIDE dedup: collect every entry already present in ANY sibling output
 * file matching `prefix` (e.g. all `whatsapp*.txt`, all `gmail*.txt`). This
 * guarantees a phone/email is never written twice anywhere in the project —
 * even across the US and Mexico files. Returns a Set of existing entries.
 */
function collectAcrossFiles(prefix) {
  const seen = new Set();
  let dir = [];
  try { dir = fs.readdirSync('.'); } catch { /* ignore */ }
  for (const name of dir) {
    if (!name.startsWith(prefix) || !name.endsWith('.txt')) continue;
    for (const line of fs.readFileSync(name, 'utf8').split('\n')) {
      const t = line.trim();
      if (t && !/^DAY\s+\d+$/i.test(t)) seen.add(t);
    }
  }
  return seen;
}

// ── Main ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync(file)) {
  console.error(`No results file at ${file} — nothing to extract.`);
  process.exit(0);
}

const rows = parseResults(fs.readFileSync(file, 'utf8'));

// DAY counter comes from the target file; the seen-sets span ALL sibling files
// so nothing is ever duplicated project-wide.
const { dayCount: phoneDay } = parseDayFile(WHATSAPP_FILE);
const { dayCount: emailDay } = parseDayFile(GMAIL_FILE);
const seenPhones = collectAcrossFiles('whatsapp');
const seenEmails = collectAcrossFiles('gmail');

const newPhones = [];
const newEmails = [];

let skippedEmails = 0;

for (const r of rows) {
  // ── Phones ──
  const phone = (r.phone || '').toString().trim();
  if (isValidPhone(phone) && !seenPhones.has(phone)) {
    seenPhones.add(phone);
    newPhones.push(phone);
  }

  // ── Emails ──
  const list = Array.isArray(r.emails) ? r.emails
             : r.email                 ? [r.email]
             : [];

  for (const e of list) {
    const email = (e || '').toString().trim().toLowerCase();
    if (!isValidEmail(email)) {
      if (email) skippedEmails++;
      continue;
    }
    if (seenEmails.has(email)) continue;
    seenEmails.add(email);
    newEmails.push(email);
  }
}

// ── Write day sections ───────────────────────────────────────────────────────

if (newPhones.length > 0) {
  const day = phoneDay + 1;
  fs.appendFileSync(WHATSAPP_FILE, `\nDAY ${day}\n${newPhones.join('\n')}\n`);
  console.error(`✔ Phones: +${newPhones.length} new → DAY ${day} in ${WHATSAPP_FILE} (${seenPhones.size} total unique)`);
} else {
  console.error(`✘ Phones: no new numbers found this run.`);
}

if (newEmails.length > 0) {
  const day = emailDay + 1;
  fs.appendFileSync(GMAIL_FILE, `\nDAY ${day}\n${newEmails.join('\n')}\n`);
  console.error(`✔ Emails: +${newEmails.length} new → DAY ${day} in ${GMAIL_FILE} (${seenEmails.size} total unique)`);
} else {
  console.error(`✘ Emails: no new emails found this run.`);
}

if (skippedEmails > 0) {
  console.error(`  (dropped ${skippedEmails} emails — failed length/format/image-ext filter)`);
}

console.error(`\nSummary: processed ${rows.length} rows from ${file}`);
