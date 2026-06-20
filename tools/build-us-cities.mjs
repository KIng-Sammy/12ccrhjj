import fs from 'node:fs';

const USPS_TO_STATE = {
  AL:'Alabama',AK:'Alaska',AZ:'Arizona',AR:'Arkansas',CA:'California',CO:'Colorado',
  CT:'Connecticut',DE:'Delaware',DC:'Washington, D.C.',FL:'Florida',GA:'Georgia',
  HI:'Hawaii',ID:'Idaho',IL:'Illinois',IN:'Indiana',IA:'Iowa',KS:'Kansas',KY:'Kentucky',
  LA:'Louisiana',ME:'Maine',MD:'Maryland',MA:'Massachusetts',MI:'Michigan',MN:'Minnesota',
  MS:'Mississippi',MO:'Missouri',MT:'Montana',NE:'Nebraska',NV:'Nevada',NH:'New Hampshire',
  NJ:'New Jersey',NM:'New Mexico',NY:'New York',NC:'North Carolina',ND:'North Dakota',
  OH:'Ohio',OK:'Oklahoma',OR:'Oregon',PA:'Pennsylvania',RI:'Rhode Island',SC:'South Carolina',
  SD:'South Dakota',TN:'Tennessee',TX:'Texas',UT:'Utah',VT:'Vermont',VA:'Virginia',
  WA:'Washington',WV:'West Virginia',WI:'Wisconsin',WY:'Wyoming',
};

// Trailing descriptors the Gazetteer appends to NAME; strip for a clean query term.
const SUFFIXES = [
  'city','town','village','borough','municipality','township',
  'consolidated government','metropolitan government','unified government',
  'metro government','urban county','corporation','plantation','gore','grant',
  'location','reservation','CDP',
];

function cleanName(name) {
  let n = name.trim();
  // strip the LAST matching descriptor word(s)
  for (const s of SUFFIXES.sort((a,b)=>b.length-a.length)) {
    const re = new RegExp('\\s+' + s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&') + '$', 'i');
    if (re.test(n)) { n = n.replace(re, ''); break; }
  }
  return n.trim();
}

const lines = fs.readFileSync('2023_Gaz_place_national.txt','utf8').split('\n');
const header = lines.shift().split('\t').map(h=>h.trim());
const iUSPS = header.indexOf('USPS');
const iNAME = header.indexOf('NAME');
const iFUNC = header.indexOf('FUNCSTAT');

const seen = new Set();
const out = [];
let cdpSkipped = 0, noState = 0;

// Buffer CDPs per state so we can fall back to them for states that have
// NO incorporated places at all (Hawaii — legally almost no municipalities).
const cdpByState = {};

for (const line of lines) {
  if (!line.trim()) continue;
  const f = line.split('\t');
  const usps = (f[iUSPS]||'').trim();
  const rawName = (f[iNAME]||'').trim();
  const func = (f[iFUNC]||'').trim();

  const state = USPS_TO_STATE[usps];
  if (!state) { noState++; continue; }

  const city = cleanName(rawName);
  if (!city) continue;

  // FUNCSTAT 'A' = active, functioning government = incorporated place.
  // Anything else (S=statistical CDP, N=nonfunctioning) → not incorporated.
  if (func !== 'A') {
    cdpSkipped++;
    (cdpByState[state] ||= []).push(city);
    continue;
  }

  const key = (city + '|' + state).toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({ city, state });
}

// Fallback for states with zero incorporated places: use their CDPs so the
// sweep still covers them (keeps all 51 represented). Hawaii is the real case.
const statesWithIncorporated = new Set(out.map(r => r.state));
for (const [state, cities] of Object.entries(cdpByState)) {
  if (statesWithIncorporated.has(state)) continue;
  for (const city of cities) {
    const key = (city + '|' + state).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ city, state });
  }
  console.log(`fallback: ${state} had no incorporated places → added ${cities.length} CDPs`);
}

// Washington, D.C. is a single federal district (no incorporated "places").
if (!statesWithIncorporated.has('Washington, D.C.')) {
  const key = 'washington|washington, d.c.';
  if (!seen.has(key)) { seen.add(key); out.push({ city: 'Washington', state: 'Washington, D.C.' }); }
  console.log('added Washington, D.C. explicitly');
}

// Stable sort: by state (full name) then city, so progress index is easy to reason about.
out.sort((a,b)=> a.state.localeCompare(b.state) || a.city.localeCompare(b.city));

fs.writeFileSync('us-cities.json', JSON.stringify(out));
console.log('incorporated places kept:', out.length);
console.log('CDP/non-incorporated skipped:', cdpSkipped);
console.log('rows with unmapped state:', noState);
// quick per-state tally sanity check
const tally = {};
for (const r of out) tally[r.state]=(tally[r.state]||0)+1;
console.log('states covered:', Object.keys(tally).length);
console.log('sample:', JSON.stringify(out.slice(0,3)), '...', JSON.stringify(out.slice(-2)));
