# iata-city-codes

[![npm version](https://img.shields.io/npm/v/iata-city-codess.svg)](https://www.npmjs.com/package/iata-city-codes)
[![bundle size](https://img.shields.io/bundlephobia/minzip/iata-city-codes)](https://bundlephobia.com/package/iata-city-codes)
[![license](https://img.shields.io/npm/l/iata-city-codes.svg)](./LICENSE)
[![downloads](https://img.shields.io/npm/dm/iata-city-codes.svg)](https://www.npmjs.com/package/iata-city-codes)

Map IATA **city codes** (metropolitan-area codes) to the individual **airport codes** they group, and back. Example: `LON` → `[LHR, LGW, STN, LTN, LCY, SEN, BQH]`.

```ts
import { getAirportsByCityCode } from "iata-city-codes";

getAirportsByCityCode("LON").map((a) => a.iata);
// ["BQH", "LCY", "LGW", "LHR", "LTN", "SEN", "STN"]
```

## Unofficial data — read this first

This is **community-sourced, unofficial data**, not IATA's own City Code Directory (which is a paid product — see [iata.org](https://www.iata.org/en/publications/directories/code-search/) if you need guaranteed-authoritative, contractually-supported data).

**Not every city code is accepted as search input by every flight-search API or GDS.** This package gives you the *mapping*; whether a given booking engine treats `LON` as a searchable origin/destination is a decision made by that engine, not by this package.

See [DATA_SOURCES.md](DATA_SOURCES.md) for exact provenance and fetch dates.

## Install

```bash
npm install iata-city-codes
```

Zero runtime dependencies. Ships ESM + CJS + types.

## Size

The dataset covers the full worldwide IATA airport list (9,250 airports, 8,827 city codes, 286 of them multi-airport). Minified bundle is ~1.2MB per module format — most of that is airport names/countries for single-airport codes, which gzip well in transit. If you only need multi-airport groupings, `getAllMultiAirportCities()` narrows that down to 286 cities.

## API

### `getAirportsByCityCode(cityCode: string): Airport[]`

```ts
getAirportsByCityCode("WAS");
// [{ iata: "BWI", ... }, { iata: "DCA", ... }, { iata: "IAD", ... }]
```

### `getCityCodeForAirport(airportCode: string): string | null`

Returns the city code an airport belongs to — or the airport's own code if it IS the city code (single-airport city).

```ts
getCityCodeForAirport("LHR"); // "LON"
getCityCodeForAirport("GVA"); // "GVA" (Geneva: single-airport city)
getCityCodeForAirport("ZZZ"); // null
```

### `getCityForAirport(airportCode: string): City | null`

```ts
getCityForAirport("LGW");
// { code: "LON", name: "London", countryCode: "GB", airports: [...] }
```

### `getCity(cityCode: string): City | null`

```ts
getCity("LON");
// { code: "LON", name: "London", countryCode: "GB", airports: [...] }
```

### `isCityCode(code: string): boolean`

```ts
isCityCode("LON"); // true
isCityCode("GVA"); // true (single-airport city, code doubles as both)
isCityCode("LHR"); // false — LHR is an airport, not a city code
```

### `isAirportCode(code: string): boolean`

```ts
isAirportCode("LHR"); // true
isAirportCode("LON"); // false — LON has no airport of its own
isAirportCode("GVA"); // true
```

### `getAllMultiAirportCities(): City[]`

Returns all 286 cities with 2+ airports grouped under them.

## Known edge cases

- **Basel–Mulhouse–Freiburg**: one physical airport, three codes — `EAP` (binational), `BSL` (Swiss side), `MLH` (French side). All three are exposed as distinct entries under city code `EAP`, each with a `notes` field explaining the relationship (pricing/domestic-status differs by code).
- **Washington, D.C. (`WAS`)**: groups `DCA`, `IAD`, and `BWI`.
- **Single-airport cities** (e.g. Geneva `GVA`): the city code and airport code coincide. `isCityCode()` and `isAirportCode()` both return `true` for these.

## Regenerating the data

```bash
npm run build:data
```

Fetches the source CSVs fresh, re-derives `src/data/airports.generated.ts` and `src/data/cities.generated.ts`, and cross-checks the multi-airport city list against Wikipedia (warns on discrepancies, doesn't fail the build).

## License

MIT
