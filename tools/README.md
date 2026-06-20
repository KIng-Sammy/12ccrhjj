# City-list build scripts

These regenerate the committed `scripts/us-cities.json` and `scripts/mx-cities.json`
from public sources. They expect the raw files to be already downloaded & unzipped in
the same directory.

## US (US Census Bureau 2023 Gazetteer — incorporated places)
```bash
curl -O https://www2.census.gov/geo/docs/maps-data/data/gazetteer/2023_Gazetteer/2023_Gaz_place_national.zip
unzip 2023_Gaz_place_national.zip
node build-us-cities.mjs        # → us-cities.json  (move to ../scripts/)
```

## Mexico (GeoNames country dump — populated places)
```bash
curl -O http://download.geonames.org/export/dump/MX.zip
curl -O http://download.geonames.org/export/dump/admin1CodesASCII.txt
unzip MX.zip && mv admin1CodesASCII.txt admin1.txt
node build-mx-cities.mjs        # → mx-cities.json  (move to ../scripts/)
```
