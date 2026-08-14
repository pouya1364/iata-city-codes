export interface Airport {
  iata: string;
  name: string;
  cityCode: string;
  countryCode: string;
  /** Notes on quirks, e.g. shared-airport codes like EAP/BSL/MLH. */
  notes?: string;
  /** Set when this code is a deprecated/legacy alias for another airport code. */
  aliasOf?: string;
}

export interface City {
  code: string;
  name: string;
  countryCode: string;
  airports: Airport[];
}

/**
 * On-disk/generated city shape: stores airport IATA codes instead of full
 * Airport objects to avoid duplicating data already in airports.generated.ts.
 * lookup.ts joins these into full City objects at runtime.
 */
export interface StoredCity {
  code: string;
  name: string;
  countryCode: string;
  airportCodes: string[];
}
