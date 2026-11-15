import {
  GeoBreadcrumbNode,
  GeoPolygonFeature,
  SelectedGeographyNode,
} from '../types/exhibition';

export interface GeoCountryStateEntry {
  name: string;
  stateCode: string;
  lat: number;
  lon: number;
  cityCount: number;
}

export interface GeoCountryProfile {
  iso2: string;
  iso3: string;
  ccn3: string;
  name: string;
  officialName: string;
  altSpellings: string[];
  continent: string;
  subregion: string;
  capital: string;
  flag: string;
  areaKm2: number | null;
  isTerritory: boolean;
  isIslandNationOrTerritory: boolean;
  lat: number;
  lon: number;
  stateCount: number;
  citiesCount: number;
  states: GeoCountryStateEntry[];
}

export interface GeoBoundaryPayload {
  available: boolean;
  iso3: string;
  level: 'ADM1' | 'ADM2' | 'ADM3';
  boundaryCanonical: string;
  boundarySource: string;
  boundaryLicense: string;
  boundaryYear: string;
  admUnitCount: number;
  reason?: string;
  features: GeoPolygonFeature[];
}

export interface GeoPlaceEntry {
  id: string;
  name: string;
  countryCode: string;
  stateCode: string;
  lat: number;
  lon: number;
  datasetSource: string;
}

export interface GeoSearchItem {
  id: string;
  name: string;
  officialName?: string;
  category:
    | 'Country'
    | 'Territory'
    | 'State / Province'
    | 'District / County'
    | 'Local Division'
    | 'City / Town'
    | 'Island'
    | 'Archipelago';
  level: 'country' | 'adm1' | 'adm2' | 'adm3' | 'city' | 'island' | 'archipelago';
  levelLabel: string;
  hierarchyLabel: string;
  iso2?: string;
  iso3?: string;
  stateCode?: string;
  flag?: string;
  ocean?: string;
  countryOrTerritory?: string;
  lat: number;
  lon: number;
  boundaryAvailable: boolean;
  datasetSource: string;
}

export interface GeoCoveragePayload {
  generatedAt: number;
  countriesCount: number;
  territoriesCount: number;
  totalCountriesAndTerritories: number;
  countries110mMapped: number;
  countries50mMapped: number;
  adm1GazetteerCount: number;
  citiesIndexedCount: number;
  adm1BoundaryCountriesLoaded: number;
  adm1BoundaryPolygonsLoaded: number;
  adm2BoundaryCountriesLoaded: number;
  adm2BoundaryPolygonsLoaded: number;
  adm3BoundaryCountriesLoaded: number;
  adm3BoundaryPolygonsLoaded: number;
  islandsMappedCount: number;
  archipelagosMappedCount: number;
  minorIslandsLoadedCount: number;
  totalPolygonsLoadedInMemory: number;
  datasets: {
    name: string;
    scope: string;
    status: string;
    coverageText: string;
    license: string;
  }[];
}

// Client-side memory cache & in-flight deduplication
const countriesCache = new Map<'110m' | '50m' | '10m', GeoPolygonFeature[]>();
const countriesInflight = new Map<'110m' | '50m' | '10m', Promise<GeoPolygonFeature[]>>();
const profileCache = new Map<string, GeoCountryProfile>();
const boundaryCache = new Map<string, GeoBoundaryPayload>();
const boundaryInflight = new Map<string, Promise<GeoBoundaryPayload>>();
let islandsCache: GeoPolygonFeature[] | null = null;
let islandsInflight: Promise<GeoPolygonFeature[]> | null = null;

export async function fetchCountriesLayer(
  detail: '110m' | '50m' | '10m' = '110m'
): Promise<GeoPolygonFeature[]> {
  const hit = countriesCache.get(detail);
  if (hit) return hit;
  const inflight = countriesInflight.get(detail);
  if (inflight) return inflight;

  const p = fetch(`/api/geo/countries?detail=${detail}`)
    .then((r) => r.json())
    .then((data) => {
      const features = Array.isArray(data.features) ? (data.features as GeoPolygonFeature[]) : [];
      countriesCache.set(detail, features);
      countriesInflight.delete(detail);
      return features;
    })
    .catch(() => {
      countriesInflight.delete(detail);
      return [] as GeoPolygonFeature[];
    });

  countriesInflight.set(detail, p);
  return p;
}

export async function fetchCountryProfile(iso3OrCode: string): Promise<GeoCountryProfile | null> {
  const key = iso3OrCode.trim().toUpperCase();
  if (!key) return null;
  const hit = profileCache.get(key);
  if (hit) return hit;

  try {
    const res = await fetch(`/api/geo/country/${encodeURIComponent(key)}`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.country) return null;
    profileCache.set(key, data.country as GeoCountryProfile);
    if (data.country.iso3) profileCache.set(data.country.iso3.toUpperCase(), data.country);
    if (data.country.iso2) profileCache.set(data.country.iso2.toUpperCase(), data.country);
    return data.country as GeoCountryProfile;
  } catch {
    return null;
  }
}

export async function fetchAdminBoundaries(
  iso3: string,
  level: 'ADM1' | 'ADM2' | 'ADM3',
  opts?: {
    parentName?: string;
    parentLevel?: 'ADM1' | 'ADM2';
    parentBbox?: [number, number, number, number];
  }
): Promise<GeoBoundaryPayload> {
  const code = iso3.trim().toUpperCase();
  const qs = new URLSearchParams();
  if (opts?.parentName) qs.set('parentName', opts.parentName);
  if (opts?.parentLevel) qs.set('parentLevel', opts.parentLevel);
  if (opts?.parentBbox) qs.set('parentBbox', opts.parentBbox.join(','));
  const cacheKey = `${code}:${level}:${qs.toString()}`;

  const hit = boundaryCache.get(cacheKey);
  if (hit) return hit;
  const inflight = boundaryInflight.get(cacheKey);
  if (inflight) return inflight;

  const url = `/api/geo/boundaries/${encodeURIComponent(code)}/${level}${qs.toString() ? `?${qs.toString()}` : ''}`;
  const p = fetch(url)
    .then((r) => r.json())
    .then((data) => {
      const payload: GeoBoundaryPayload = {
        available: Boolean(data.available),
        iso3: code,
        level,
        boundaryCanonical: String(data.boundaryCanonical ?? level),
        boundarySource: String(data.boundarySource ?? 'geoBoundaries Open'),
        boundaryLicense: String(data.boundaryLicense ?? 'Open'),
        boundaryYear: String(data.boundaryYear ?? 'Unknown'),
        admUnitCount: Number(data.admUnitCount ?? 0),
        reason: data.reason,
        features: Array.isArray(data.features) ? (data.features as GeoPolygonFeature[]) : [],
      };
      boundaryCache.set(cacheKey, payload);
      boundaryInflight.delete(cacheKey);
      return payload;
    })
    .catch(() => {
      boundaryInflight.delete(cacheKey);
      return {
        available: false,
        iso3: code,
        level,
        boundaryCanonical: level,
        boundarySource: 'geoBoundaries Open',
        boundaryLicense: 'Unavailable',
        boundaryYear: 'Unavailable',
        admUnitCount: 0,
        reason: 'Boundary Unavailable: failed to connect to server boundary service.',
        features: [],
      };
    });

  boundaryInflight.set(cacheKey, p);
  return p;
}

export async function fetchPlaces(params: {
  iso2?: string;
  stateCode?: string;
  bbox?: [number, number, number, number];
  q?: string;
  limit?: number;
}): Promise<GeoPlaceEntry[]> {
  const qs = new URLSearchParams();
  if (params.iso2) qs.set('iso2', params.iso2);
  if (params.stateCode) qs.set('stateCode', params.stateCode);
  if (params.q) qs.set('q', params.q);
  if (params.limit) qs.set('limit', String(params.limit));
  if (params.bbox) {
    qs.set('minLon', String(params.bbox[0]));
    qs.set('minLat', String(params.bbox[1]));
    qs.set('maxLon', String(params.bbox[2]));
    qs.set('maxLat', String(params.bbox[3]));
  }
  try {
    const res = await fetch(`/api/geo/places?${qs.toString()}`);
    const data = await res.json();
    return Array.isArray(data.places) ? (data.places as GeoPlaceEntry[]) : [];
  } catch {
    return [];
  }
}

export async function fetchIslandsLayer(): Promise<GeoPolygonFeature[]> {
  if (islandsCache) return islandsCache;
  if (islandsInflight) return islandsInflight;
  islandsInflight = fetch('/api/geo/islands')
    .then((r) => r.json())
    .then((data) => {
      const features = Array.isArray(data.features) ? (data.features as GeoPolygonFeature[]) : [];
      islandsCache = features;
      islandsInflight = null;
      return features;
    })
    .catch(() => {
      islandsInflight = null;
      return [] as GeoPolygonFeature[];
    });
  return islandsInflight;
}

export async function fetchMinorIslandsInBbox(
  bbox: [number, number, number, number]
): Promise<GeoPolygonFeature[]> {
  try {
    const qs = new URLSearchParams({
      minLon: bbox[0].toFixed(2),
      minLat: bbox[1].toFixed(2),
      maxLon: bbox[2].toFixed(2),
      maxLat: bbox[3].toFixed(2),
    });
    const res = await fetch(`/api/geo/minor-islands?${qs.toString()}`);
    const data = await res.json();
    return Array.isArray(data.features) ? (data.features as GeoPolygonFeature[]) : [];
  } catch {
    return [];
  }
}

export async function searchGlobalGeography(query: string, limit = 16): Promise<GeoSearchItem[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const res = await fetch(`/api/geo/search?q=${encodeURIComponent(q)}&limit=${limit}`);
    const data = await res.json();
    return Array.isArray(data.results) ? (data.results as GeoSearchItem[]) : [];
  } catch {
    return [];
  }
}

export async function fetchGeoCoverage(): Promise<GeoCoveragePayload | null> {
  try {
    const res = await fetch('/api/geo/coverage');
    const data = await res.json();
    return (data.coverage as GeoCoveragePayload) ?? null;
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// Spherical Point-in-Polygon Hit Testing & Camera Distance Fitting
// -----------------------------------------------------------------------------
function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersect =
      yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

export function findPolygonFeatureAtLatLon(
  features: GeoPolygonFeature[],
  lat: number,
  lon: number
): GeoPolygonFeature | null {
  for (let i = 0; i < features.length; i++) {
    const f = features[i];
    const [minLon, minLat, maxLon, maxLat] = f.bbox;
    if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) continue;
    for (let r = 0; r < f.rings.length; r++) {
      if (pointInRing(lon, lat, f.rings[r])) {
        return f;
      }
    }
  }
  return null;
}

export function computeRecommendedDistanceForBbox(
  bbox?: [number, number, number, number],
  fallback = 2.15
): number {
  if (!bbox) return fallback;
  const lonSpan = Math.abs(bbox[2] - bbox[0]);
  const latSpan = Math.abs(bbox[3] - bbox[1]);
  // Guard antimeridian spanning countries like Russia/USA/Fiji
  const safeLonSpan = lonSpan > 180 ? 48 : lonSpan;
  const span = Math.max(latSpan, safeLonSpan * 0.72);
  if (span > 45) return 2.85;
  if (span > 20) return 2.35;
  if (span > 9) return 2.05;
  if (span > 3.5) return 1.86;
  return 1.72;
}

export function buildSelectedGeographyFromFeature(
  feature: GeoPolygonFeature,
  parentBreadcrumbs?: GeoBreadcrumbNode[]
): SelectedGeographyNode {
  const earthNode: GeoBreadcrumbNode = {
    id: 'earth-root',
    name: 'Earth',
    level: 'earth',
    levelLabel: 'Planet',
    lat: 16,
    lon: 76,
  };

  let breadcrumbs: GeoBreadcrumbNode[] = [earthNode];

  if (parentBreadcrumbs && parentBreadcrumbs.length > 0) {
    breadcrumbs = [...parentBreadcrumbs];
  } else if (feature.level === 'island' || feature.level === 'archipelago' || feature.level === 'minor-island') {
    if (feature.ocean) {
      breadcrumbs.push({
        id: `ocean-${feature.ocean.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: feature.ocean,
        level: 'ocean',
        levelLabel: 'Ocean / Sea',
        ocean: feature.ocean,
        lat: feature.lat,
        lon: feature.lon,
      });
    }
    if (feature.islandRegion && feature.islandRegion !== feature.ocean) {
      breadcrumbs.push({
        id: `island-region-${feature.islandRegion.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: feature.islandRegion,
        level: 'island-region',
        levelLabel: 'Island Region',
        ocean: feature.ocean,
        lat: feature.lat,
        lon: feature.lon,
      });
    }
  } else {
    if (feature.continent) {
      breadcrumbs.push({
        id: `continent-${feature.continent.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
        name: feature.continent,
        level: 'continent',
        levelLabel: 'Continent',
        lat: feature.lat,
        lon: feature.lon,
      });
    }
    if (feature.level !== 'country' && feature.countryOrTerritory && feature.iso3) {
      breadcrumbs.push({
        id: `country-${feature.iso3}`,
        name: feature.countryOrTerritory,
        level: 'country',
        levelLabel: 'Country / Territory',
        iso2: feature.iso2,
        iso3: feature.iso3,
        lat: feature.lat,
        lon: feature.lon,
      });
    }
  }

  // Append self if not already tail
  const selfNode: GeoBreadcrumbNode = {
    id: feature.id,
    name: feature.name,
    level: feature.level,
    levelLabel: feature.levelLabel,
    iso2: feature.iso2,
    iso3: feature.iso3,
    stateCode: feature.stateCode,
    ocean: feature.ocean,
    lat: feature.lat,
    lon: feature.lon,
    bbox: feature.bbox,
  };

  const existingIdx = breadcrumbs.findIndex((b) => b.id === selfNode.id || (b.level === selfNode.level && b.name === selfNode.name));
  if (existingIdx >= 0) {
    breadcrumbs = [...breadcrumbs.slice(0, existingIdx), selfNode];
  } else {
    breadcrumbs.push(selfNode);
  }

  return {
    id: feature.id,
    name: feature.name,
    officialName: feature.officialName,
    level: feature.level,
    levelLabel: feature.levelLabel,
    breadcrumbs,
    iso2: feature.iso2,
    iso3: feature.iso3,
    ccn3: feature.ccn3,
    stateCode: feature.stateCode,
    capital: feature.capital,
    flag: feature.flag,
    continent: feature.continent,
    subregion: feature.subregion,
    ocean: feature.ocean,
    islandRegion: feature.islandRegion,
    countryOrTerritory: feature.countryOrTerritory,
    isTerritory: feature.isTerritory,
    areaKm2: feature.areaKm2,
    population: feature.population,
    lat: feature.lat,
    lon: feature.lon,
    bbox: feature.bbox,
    boundaryAvailable: feature.boundaryAvailable,
    datasetSource: feature.datasetSource,
    datasetYear: feature.datasetYear,
    datasetLicense: feature.datasetLicense,
    rings: feature.rings,
  };
}
