/**
 * Load scraped Google Maps results into MongoDB.
 *
 * Reads the JSON produced by gosom/google-maps-scraper (`-json`), normalises the
 * fields we care about for outreach, and UPSERTS into a `leads` collection so
 * re-runs dedupe instead of duplicating.
 *
 * Env:
 *   MONGODB_URI   (required) — your connection string (GitHub secret)
 *   MONGODB_DB    (optional) — database name (default: chef_assist)
 *   LEADS_QUERY   (optional) — the search text, stored on each lead for reference
 *
 * Usage:  node scripts/to-mongo.js out/results.json
 */
import fs from 'node:fs';
import { MongoClient } from 'mongodb';

const file = process.argv[2] || 'out/results.json';
const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGODB_DB || 'chef_assist';

if (!uri) {
  console.error('✗ MONGODB_URI is not set');
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`✗ results file not found: ${file}`);
  process.exit(1);
}

/** The scraper may emit a JSON array OR newline-delimited JSON. Handle both. */
function parseResults(raw) {
  const text = raw.trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    return Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    // JSON-lines fallback
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

function normalise(r) {
  const emails = Array.isArray(r.emails) ? r.emails.filter(Boolean) : [];
  return {
    name: r.title || r.name || '',
    phone: r.phone || '',
    website: r.website || '',
    email: emails[0] || '',
    emails,
    address: r.complete_address?.string || r.address || r.complete_address || '',
    rating: r.review_rating ?? r.rating ?? null,
    reviews: r.review_count ?? r.reviews ?? null,
    category: r.category || '',
    placeId: r.place_id || '',
    cid: r.cid || '',
    lat: r.latitude ?? null,
    lng: r.longitude ?? null,
    mapsUrl: r.link || r.google_maps_url || '',
    query: process.env.LEADS_QUERY || '',
    // No Date.now() concerns here — this runs as a normal script, not a workflow journal.
    scrapedAt: new Date(),
    // Outreach tracking you can update later.
    status: 'new',
  };
}

/** A stable key so re-runs upsert instead of duplicating. */
function keyFor(lead) {
  if (lead.placeId) return { placeId: lead.placeId };
  if (lead.cid) return { cid: lead.cid };
  return { name: lead.name, address: lead.address };
}

async function main() {
  const rows = parseResults(fs.readFileSync(file, 'utf8'));
  const leads = rows.map(normalise).filter((l) => l.name);
  console.error(`Parsed ${leads.length} leads from ${file}`);

  if (!leads.length) {
    console.error('Nothing to load.');
    return;
  }

  const client = new MongoClient(uri);
  await client.connect();
  try {
    const col = client.db(dbName).collection('leads');
    await col.createIndex({ placeId: 1 }, { sparse: true });

    let upserts = 0;
    for (const lead of leads) {
      // eslint-disable-next-line no-await-in-loop
      const res = await col.updateOne(
        keyFor(lead),
        {
          $set: { ...lead, updatedAt: new Date() },
          $setOnInsert: { firstSeenAt: new Date() },
        },
        { upsert: true }
      );
      if (res.upsertedCount || res.modifiedCount) upserts += 1;
    }
    console.error(`✓ Upserted/updated ${upserts} leads into ${dbName}.leads`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('✗', err.message);
  process.exit(1);
});
