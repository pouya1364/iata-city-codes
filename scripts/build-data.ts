// Fetches lxndrblz/Airports CSVs, groups airports by city_code, and writes
// src/data/airports.generated.ts + src/data/cities.generated.ts. Re-run this
// script (not hand-edit the generated files) when upstream data changes.
//
// Sources (see DATA_SOURCES.md for full provenance):
// - https://raw.githubusercontent.com/lxndrblz/Airports/main/airports.csv
// - https://raw.githubusercontent.com/lxndrblz/Airports/main/citycodes.csv
// - https://en.wikipedia.org/wiki/List_of_cities_with_more_than_one_commercial_airport (cross-check)

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import type { Airport, StoredCity } from "../src/types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const AIRPORTS_URL =
  "https://raw.githubusercontent.com/lxndrblz/Airports/main/airports.csv";
const CITYCODES_URL =
  "https://raw.githubusercontent.com/lxndrblz/Airports/main/citycodes.csv";
const WIKI_MULTI_AIRPORT_URL =
  "https://en.wikipedia.org/wiki/List_of_cities_with_more_than_one_commercial_airport";

// Minimal quoted-field-aware CSV parser (upstream CSV has unescaped commas
// in a few "name" fields, so a naive split(",") misaligns columns).
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1);
}

interface SourceRow {
  code: string;
  icao: string;
  name: string;
  city_code: string;
  country: string;
  city: string;
  type: string;
}

function toRows(csvText: string): SourceRow[] {
  const [header = [], ...rows] = parseCsv(csvText);
  const idx = (col: string) => header.indexOf(col);
  return rows.map((r) => ({
    code: r[idx("code")] ?? "",
    icao: r[idx("icao")] ?? "",
    name: r[idx("name")] ?? "",
    city_code: r[idx("city_code")] ?? "",
    country: r[idx("country")] ?? "",
    city: r[idx("city")] ?? "",
    type: r[idx("type")] ?? "",
  }));
}

// Manual overrides for known edge cases the source data gets wrong or
// leaves ambiguous. See CLAUDE.md "Known Edge Cases" for the rationale.
const CITY_CODE_OVERRIDES: Record<string, string> = {
  // Upstream only maps DCA/IAD to WAS; BWI is commonly grouped under the
  // Washington, D.C. metro code too (confirmed against Wikivoyage).
  BWI: "WAS",
};

const AIRPORT_NOTES: Record<string, string> = {
  EAP: "Binational code for Basel-Mulhouse-Freiburg Airport, shared with BSL (Swiss side) and MLH (French side). Same physical airport, three codes.",
  BSL: "Swiss-side code for the physical airport also known as EAP (binational) / MLH (French side). Flights priced to BSL are not domestic from France.",
  MLH: "French-side code for the physical airport also known as EAP (binational) / BSL (Swiss side). Flights priced to MLH are domestic from France.",
};

async function main() {
  console.log("Fetching source CSVs...");
  const [airportsCsv, cityCodesCsv] = await Promise.all([
    fetch(AIRPORTS_URL).then((r) => r.text()),
    fetch(CITYCODES_URL).then((r) => r.text()),
  ]);

  const airportRows = toRows(airportsCsv).filter((r) => r.type === "AP");
  const cityCodeRows = toRows(cityCodesCsv).filter((r) => r.type === "CC");

  const cityMeta = new Map<string, { name: string; countryCode: string }>();
  for (const r of cityCodeRows) {
    cityMeta.set(r.code, { name: r.name, countryCode: r.country });
  }

  const airports: Airport[] = airportRows.map((r) => {
    const cityCode = CITY_CODE_OVERRIDES[r.code] ?? r.city_code;
    const airport: Airport = {
      iata: r.code,
      name: r.name,
      cityCode,
      countryCode: r.country,
    };
    const notes = AIRPORT_NOTES[r.code];
    if (notes) airport.notes = notes;
    return airport;
  });

  // Dedupe (upstream occasionally lists the same IATA code twice).
  const airportsByIata = new Map<string, Airport>();
  for (const a of airports) {
    if (!airportsByIata.has(a.iata)) airportsByIata.set(a.iata, a);
  }
  const uniqueAirports = [...airportsByIata.values()].sort((a, b) =>
    a.iata.localeCompare(b.iata)
  );

  const citiesByCode = new Map<string, StoredCity>();
  for (const airport of uniqueAirports) {
    const code = airport.cityCode;
    let city = citiesByCode.get(code);
    if (!city) {
      const meta = cityMeta.get(code);
      city = {
        code,
        name: meta?.name.replace(/ Metropolitan Area$/, "") ?? airport.name,
        countryCode: meta?.countryCode ?? airport.countryCode,
        airportCodes: [],
      };
      citiesByCode.set(code, city);
    }
    city.airportCodes.push(airport.iata);
  }

  const cities = [...citiesByCode.values()].sort((a, b) =>
    a.code.localeCompare(b.code)
  );

  console.log(
    `Built ${uniqueAirports.length} airports across ${cities.length} city codes ` +
      `(${cities.filter((c) => c.airportCodes.length > 1).length} multi-airport).`
  );

  await crossCheckWikipedia(cities);

  const dataDir = path.join(__dirname, "..", "src", "data");
  const header = (source: string) =>
    `// AUTO-GENERATED by scripts/build-data.ts — do not edit by hand.\n` +
    `// Re-run \`npm run build:data\` to regenerate from ${source}.\n` +
    `// See DATA_SOURCES.md for provenance.\n\n`;

  writeFileSync(
    path.join(dataDir, "airports.generated.ts"),
    header("lxndrblz/Airports airports.csv") +
      `import type { Airport } from "../types.js";\n\n` +
      `export const airports: Airport[] = ${JSON.stringify(uniqueAirports, null, 2)};\n`
  );
  writeFileSync(
    path.join(dataDir, "cities.generated.ts"),
    header("lxndrblz/Airports airports.csv + citycodes.csv") +
      `import type { StoredCity } from "../types.js";\n\n` +
      `export const cities: StoredCity[] = ${JSON.stringify(cities, null, 2)};\n`
  );
  console.log(
    "Wrote src/data/airports.generated.ts and src/data/cities.generated.ts"
  );
}

// Cross-check our multi-airport city list against Wikipedia's human-curated
// list, and warn (not fail) on cities present in one source but not the
// other, so gaps get reviewed manually rather than silently dropped.
async function crossCheckWikipedia(cities: StoredCity[]) {
  let html: string;
  try {
    html = await fetch(WIKI_MULTI_AIRPORT_URL).then((r) => r.text());
  } catch (err) {
    console.warn(`Skipping Wikipedia cross-check (fetch failed): ${err}`);
    return;
  }

  const ourMultiAirportCities = new Set(
    cities
      .filter((c) => c.airportCodes.length > 1)
      .map((c) => c.name.toLowerCase())
  );

  // Wikipedia list rows contain city names as link text in table cells;
  // a full HTML table parse is overkill here, so pattern-match likely
  // city-name link text and flag anything not in our set for manual review.
  const linkMatches = [...html.matchAll(/title="([A-Z][a-zA-Z.\-' ]+)"/g)].map(
    (m) => (m[1] ?? "").toLowerCase()
  );
  const wikiCityNames = new Set(linkMatches);

  const missingFromOurs = [...wikiCityNames].filter(
    (name) =>
      cities.some((c) => c.name.toLowerCase() === name) &&
      !ourMultiAirportCities.has(name)
  );

  if (missingFromOurs.length > 0) {
    console.warn(
      "Wikipedia cross-check: cities matched by name but not grouped as " +
        "multi-airport in our data (manual review recommended):",
      missingFromOurs.slice(0, 20)
    );
  } else {
    console.log("Wikipedia cross-check: no obvious gaps detected.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
