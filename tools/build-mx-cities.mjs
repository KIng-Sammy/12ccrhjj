import fs from 'node:fs';

// admin1 code (e.g. "14") -> state name, from admin1CodesASCII.txt ("MX.14\tJalisco\t...")
const admin1 = {};
for (const line of fs.readFileSync('admin1.txt','utf8').split('\n')) {
  if (!line.startsWith('MX.')) continue;
  const f = line.split('\t');
  const code = f[0].slice(3);        // after "MX."
  admin1[code] = (f[1]||'').trim();  // full UTF-8 name
}

// GeoNames columns:
// 0 geonameid 1 name 2 asciiname 3 alternatenames 4 lat 5 lng
// 6 feature_class 7 feature_code 8 country 9 cc2 10 admin1 ... 14 population
const rows = fs.readFileSync('MX.txt','utf8').split('\n');

const seen = new Set();
const out = [];

for (const line of rows) {
  if (!line) continue;
  const f = line.split('\t');
  if (f[6] !== 'P') continue;                 // populated places only
  const code = f[7];
  const pop = parseInt(f[14] || '0', 10) || 0;

  // Keep real towns/cities: any administrative seat OR a place with a known
  // population. Drops the ~170k unpopulated micro-hamlets (PPLX/PPL pop=0).
  const isSeat = code === 'PPLC' || code.startsWith('PPLA');
  if (!isSeat && pop <= 0) continue;

  const city = (f[1] || f[2] || '').trim();   // prefer UTF-8 name
  if (!city) continue;
  const state = admin1[f[10]] || '';

  const key = (city + '|' + state).toLowerCase();
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({ city, state, pop });
}

// Sort by population desc so the biggest markets (most restaurants) are hit first.
out.sort((a,b) => b.pop - a.pop || a.city.localeCompare(b.city));

const slim = out.map(({city,state}) => ({ city, state }));
fs.writeFileSync('mx-cities.json', JSON.stringify(slim));
console.log('Mexico places kept:', slim.length);
console.log('states covered:', new Set(out.map(r=>r.state)).size);
console.log('top 5:', JSON.stringify(out.slice(0,5)));
console.log('sample tail:', JSON.stringify(slim.slice(-3)));
