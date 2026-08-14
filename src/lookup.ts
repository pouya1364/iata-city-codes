import { airports } from "./data/airports.generated.js";
import { cities as storedCities } from "./data/cities.generated.js";
import type { Airport, City, StoredCity } from "./types.js";

const airportsByIata = new Map<string, Airport>();
for (const a of airports) airportsByIata.set(a.iata, a);

const citiesByCode = new Map<string, StoredCity>();
for (const c of storedCities) citiesByCode.set(c.code, c);

function toCity(stored: StoredCity): City {
  return {
    code: stored.code,
    name: stored.name,
    countryCode: stored.countryCode,
    airports: stored.airportCodes
      .map((iata) => airportsByIata.get(iata))
      .filter((a): a is Airport => a !== undefined),
  };
}

export function getAirportsByCityCode(cityCode: string): Airport[] {
  const stored = citiesByCode.get(cityCode.toUpperCase());
  if (!stored) return [];
  return toCity(stored).airports;
}

export function getCityCodeForAirport(airportCode: string): string | null {
  return airportsByIata.get(airportCode.toUpperCase())?.cityCode ?? null;
}

export function getCityForAirport(airportCode: string): City | null {
  const airport = airportsByIata.get(airportCode.toUpperCase());
  if (!airport) return null;
  const stored = citiesByCode.get(airport.cityCode);
  return stored ? toCity(stored) : null;
}

export function getCity(cityCode: string): City | null {
  const stored = citiesByCode.get(cityCode.toUpperCase());
  return stored ? toCity(stored) : null;
}

export function isCityCode(code: string): boolean {
  return citiesByCode.has(code.toUpperCase());
}

export function isAirportCode(code: string): boolean {
  return airportsByIata.has(code.toUpperCase());
}

export function getAllMultiAirportCities(): City[] {
  return storedCities
    .filter((c) => c.airportCodes.length >= 2)
    .map(toCity);
}
