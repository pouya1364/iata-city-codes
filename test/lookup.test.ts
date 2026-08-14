import { describe, expect, it } from "vitest";
import {
  getAirportsByCityCode,
  getAllMultiAirportCities,
  getCity,
  getCityCodeForAirport,
  getCityForAirport,
  isAirportCode,
  isCityCode,
} from "../src/index.js";
import { airports as airportsData } from "../src/data/airports.generated.js";
import { cities as citiesData } from "../src/data/cities.generated.js";

describe("getAirportsByCityCode", () => {
  it("returns all London airports for LON", () => {
    const codes = getAirportsByCityCode("LON").map((a) => a.iata).sort();
    expect(codes).toEqual(["BQH", "LCY", "LGW", "LHR", "LTN", "SEN", "STN"]);
  });

  it("is case-insensitive", () => {
    expect(getAirportsByCityCode("lon").length).toBeGreaterThan(0);
  });

  it("returns an empty array for an unknown code", () => {
    expect(getAirportsByCityCode("ZZZ")).toEqual([]);
  });
});

describe("getCityCodeForAirport", () => {
  it("maps LHR to LON", () => {
    expect(getCityCodeForAirport("LHR")).toBe("LON");
  });

  it("returns the code itself for a single-airport city (GVA)", () => {
    expect(getCityCodeForAirport("GVA")).toBe("GVA");
  });

  it("returns null for an unknown code", () => {
    expect(getCityCodeForAirport("ZZZ")).toBeNull();
  });
});

describe("getCityForAirport / getCity", () => {
  it("returns full city info for an airport", () => {
    const city = getCityForAirport("LGW");
    expect(city?.code).toBe("LON");
    expect(city?.airports.map((a) => a.iata)).toContain("LHR");
  });

  it("getCity returns the same shape as getCityForAirport", () => {
    expect(getCity("LON")).toEqual(getCityForAirport("LHR"));
  });

  it("returns null for unknown codes", () => {
    expect(getCityForAirport("ZZZ")).toBeNull();
    expect(getCity("ZZZ")).toBeNull();
  });
});

describe("isCityCode / isAirportCode", () => {
  it("GVA is both a city code and an airport code (single-airport city)", () => {
    expect(isCityCode("GVA")).toBe(true);
    expect(isAirportCode("GVA")).toBe(true);
  });

  it("LON is a city code but not an airport code", () => {
    expect(isCityCode("LON")).toBe(true);
    expect(isAirportCode("LON")).toBe(false);
  });

  it("LHR is an airport code but not a city code", () => {
    expect(isAirportCode("LHR")).toBe(true);
    expect(isCityCode("LHR")).toBe(false);
  });
});

describe("getAllMultiAirportCities", () => {
  it("only includes cities with 2+ airports", () => {
    const cities = getAllMultiAirportCities();
    expect(cities.length).toBeGreaterThan(0);
    for (const city of cities) {
      expect(city.airports.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("includes London and Washington D.C.", () => {
    const codes = getAllMultiAirportCities().map((c) => c.code);
    expect(codes).toContain("LON");
    expect(codes).toContain("WAS");
  });
});

describe("known edge cases", () => {
  it("Washington D.C. (WAS) groups DCA, IAD, and BWI", () => {
    const codes = getAirportsByCityCode("WAS").map((a) => a.iata).sort();
    expect(codes).toEqual(["BWI", "DCA", "IAD"]);
  });

  it("EAP/BSL/MLH are exposed as three distinct airport codes under EAP, with notes", () => {
    const city = getCity("EAP");
    expect(city).not.toBeNull();
    const codes = city!.airports.map((a) => a.iata).sort();
    expect(codes).toEqual(["BSL", "EAP", "MLH"]);
    for (const airport of city!.airports) {
      expect(airport.notes).toBeTruthy();
    }
  });

  it("Geneva (GVA) is a single-airport city where the city code equals the airport code", () => {
    const city = getCity("GVA");
    expect(city?.airports).toHaveLength(1);
    expect(city?.airports[0]?.iata).toBe("GVA");
  });
});

describe("data integrity", () => {
  const airports = airportsData as { iata: string; cityCode: string }[];
  const cities = citiesData as { code: string; airportCodes: string[] }[];
  const cityCodesSet = new Set(cities.map((c) => c.code));

  it("every airport has a valid 3-letter IATA code", () => {
    for (const a of airports) {
      expect(a.iata).toMatch(/^[A-Z]{3}$/);
    }
  });

  it("has no duplicate airport codes", () => {
    const seen = new Set<string>();
    for (const a of airports) {
      expect(seen.has(a.iata)).toBe(false);
      seen.add(a.iata);
    }
  });

  it("every airport's cityCode references an existing city", () => {
    for (const a of airports) {
      expect(cityCodesSet.has(a.cityCode)).toBe(true);
    }
  });

  it("every city's airportCodes reference existing airports", () => {
    const airportIatas = new Set(airports.map((a) => a.iata));
    for (const c of cities) {
      for (const code of c.airportCodes) {
        expect(airportIatas.has(code)).toBe(true);
      }
    }
  });

  it("has no duplicate city codes", () => {
    const seen = new Set<string>();
    for (const c of cities) {
      expect(seen.has(c.code)).toBe(false);
      seen.add(c.code);
    }
  });
});
