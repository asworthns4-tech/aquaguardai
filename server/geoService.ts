import { createRequire } from 'node:module';
import * as topojsonClient from 'topojson-client';
import { Country, State, City } from 'country-state-city';
import worldCountries from 'world-countries';

const require = createRequire(import.meta.url);

export type GeoDetailLevel = '110m' | '50m' | '10m';
export type GeoAdminLevel = 'ADM1' | 'ADM2' | 'ADM3';

export interface SimplePolygonFeature {
  id: string;
  name: string;
  level: 'country' | 'adm1' | 'adm2' | 'adm3' | 'island' | 'archipelago' | 'minor-island';
  levelLabel: string;
  iso2?: string;
  iso3?: string;
  ccn3?: string;
  stateCode?: string;
  officialName?: string;
  altSpellings?: string[];
  continent?: string;
  subregion?: string;
  capital?: string;
  flag?: string;
  areaKm2?: number | null;
  population?: number | null;
  isTerritory?: boolean;
  ocean?: string;
  islandRegion?: string;
  countryOrTerritory?: string;
  lat: number;
  lon: number;
  bbox: [number, number, number, number]; // [minLon, minLat, maxLon, maxLat]
  rings: number[][][]; // Array of outer/major closed rings: [ [ [lon, lat], ... ], ... ]
  datasetSource: string;
  datasetYear?: string;
  datasetLicense?: string;
  boundaryAvailable: boolean;
}

export interface GeoCountryMeta {
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
}

export interface GeoBoundaryResponse {
  available: boolean;
  iso3: string;
  level: GeoAdminLevel;
  boundaryCanonical: string;
  boundarySource: string;
  boundaryLicense: string;
  boundaryYear: string;
  admUnitCount: number;
  reason?: string;
  features: SimplePolygonFeature[];
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
    status: 'Loaded' | 'On-Demand' | 'Loaded on Demand' | 'Partial / Country-Dependent';
    coverageText: string;
    license: string;
  }[];
}

// -----------------------------------------------------------------------------
// In-memory caches (zero bundle bloat, server-side fast indexing)
// -----------------------------------------------------------------------------
const countryLayerCache = new Map<GeoDetailLevel, SimplePolygonFeature[]>();
const rawAdmCache = new Map<
  string,
  {
    available: boolean;
    boundaryCanonical: string;
    boundarySource: string;
    boundaryLicense: string;
    boundaryYear: string;
    admUnitCount: number;
    reason?: string;
    features: SimplePolygonFeature[];
  }
>();
let cachedIslands: SimplePolygonFeature[] | null = null;
let islandsLoadPromise: Promise<SimplePolygonFeature[]> | null = null;
let cachedMinorIslands: SimplePolygonFeature[] | null = null;
let minorIslandsLoadPromise: Promise<SimplePolygonFeature[]> | null = null;

// Build fast lookup indices from world-countries + country-state-city once at startup
const ALL_STATES = State.getAllStates();
const ALL_CITIES = City.getAllCities();
const ALL_CSC_COUNTRIES = Country.getAllCountries();

const STATE_COUNT_BY_ISO2 = new Map<string, number>();
for (const s of ALL_STATES) {
  STATE_COUNT_BY_ISO2.set(s.countryCode, (STATE_COUNT_BY_ISO2.get(s.countryCode) ?? 0) + 1);
}

function resolveContinent(region: string, subregion: string): string {
  if (region === 'Americas') {
    const sub = subregion.toLowerCase();
    if (sub.includes('south')) return 'South America';
    return 'North America';
  }
  return region || 'Earth';
}

const COUNTRY_META_LIST: GeoCountryMeta[] = worldCountries.map((wc) => {
  const lat = Array.isArray(wc.latlng) && wc.latlng.length >= 2 ? Number(wc.latlng[0]) : 0;
  const lon = Array.isArray(wc.latlng) && wc.latlng.length >= 2 ? Number(wc.latlng[1]) : 0;
  const continent = resolveContinent(wc.region ?? '', wc.subregion ?? '');
  const sub = (wc.subregion ?? '').toLowerCase();
  const hasLandBorders = Array.isArray(wc.borders) && wc.borders.length > 0;
  const isIslandNationOrTerritory =
    wc.region === 'Oceania' ||
    sub.includes('caribbean') ||
    sub.includes('polynesia') ||
    sub.includes('micronesia') ||
    sub.includes('melanesia') ||
    (!wc.landlocked && !hasLandBorders);

  return {
    iso2: wc.cca2,
    iso3: wc.cca3,
    ccn3: wc.ccn3 ? String(wc.ccn3).padStart(3, '0') : '',
    name: wc.name?.common ?? wc.cca3,
    officialName: wc.name?.official ?? wc.name?.common ?? wc.cca3,
    altSpellings: Array.isArray(wc.altSpellings) ? wc.altSpellings : [],
    continent,
    subregion: wc.subregion ?? '',
    capital: Array.isArray(wc.capital) && wc.capital.length > 0 ? wc.capital[0] : 'Data Unavailable',
    flag: wc.flag ?? '',
    areaKm2: typeof wc.area === 'number' && wc.area > 0 ? wc.area : null,
    isTerritory: wc.independent === false,
    isIslandNationOrTerritory,
    lat,
    lon,
    stateCount: STATE_COUNT_BY_ISO2.get(wc.cca2) ?? 0,
  };
});

const META_BY_ISO3 = new Map<string, GeoCountryMeta>();
const META_BY_ISO2 = new Map<string, GeoCountryMeta>();
const META_BY_CCN3 = new Map<string, GeoCountryMeta>();
const META_BY_NAME = new Map<string, GeoCountryMeta>();

for (const meta of COUNTRY_META_LIST) {
  META_BY_ISO3.set(meta.iso3.toUpperCase(), meta);
  META_BY_ISO2.set(meta.iso2.toUpperCase(), meta);
  if (meta.ccn3) {
    META_BY_CCN3.set(meta.ccn3, meta);
    META_BY_CCN3.set(String(Number(meta.ccn3)), meta);
  }
  META_BY_NAME.set(meta.name.toLowerCase(), meta);
  META_BY_NAME.set(meta.officialName.toLowerCase(), meta);
}

// -----------------------------------------------------------------------------
// Geometry Simplification & Spatial Helpers
// -----------------------------------------------------------------------------
function computeRingStats(rings: number[][][]): {
  bbox: [number, number, number, number];
  lat: number;
  lon: number;
} {
  let minLon = 180;
  let maxLon = -180;
  let minLat = 90;
  let maxLat = -90;
  let largestRing: number[][] = [];

  for (const ring of rings) {
    if (ring.length > largestRing.length) largestRing = ring;
    for (const pt of ring) {
      const lon = pt[0];
      const lat = pt[1];
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
  }

  if (minLon > maxLon || minLat > maxLat) {
    return { bbox: [0, 0, 0, 0], lat: 0, lon: 0 };
  }

  let sumLon = 0;
  let sumLat = 0;
  const pts = largestRing.length > 0 ? largestRing : rings[0] ?? [];
  for (const pt of pts) {
    sumLon += pt[0];
    sumLat += pt[1];
  }
  const lat = pts.length > 0 ? sumLat / pts.length : (minLat + maxLat) / 2;
  const lon = pts.length > 0 ? sumLon / pts.length : (minLon + maxLon) / 2;

  return {
    bbox: [
      Number(minLon.toFixed(4)),
      Number(minLat.toFixed(4)),
      Number(maxLon.toFixed(4)),
      Number(maxLat.toFixed(4)),
    ],
    lat: Number(lat.toFixed(4)),
    lon: Number(lon.toFixed(4)),
  };
}

function simplifyRing(ring: number[][], maxPoints: number): number[][] {
  if (!Array.isArray(ring) || ring.length < 3) return [];
  const step = ring.length > maxPoints ? Math.ceil(ring.length / maxPoints) : 1;
  const out: number[][] = [];
  for (let i = 0; i < ring.length; i += step) {
    const lon = Number(ring[i][0].toFixed(4));
    const lat = Number(ring[i][1].toFixed(4));
    if (Number.isFinite(lon) && Number.isFinite(lat)) {
      out.push([lon, lat]);
    }
  }
  if (out.length < 3) return [];
  const first = out[0];
  const last = out[out.length - 1];
  if (first[0] !== last[0] || first[1] !== last[1]) {
    out.push([first[0], first[1]]);
  }
  return out.length >= 4 ? out : [];
}

function extractOuterRingsFromGeometry(
  geometry: { type?: string; coordinates?: unknown } | null | undefined,
  maxPointsPerRing: number,
  maxRingsPerFeature = 24
): number[][][] {
  if (!geometry || !geometry.type || !geometry.coordinates) return [];
  const rawRings: number[][][] = [];

  if (geometry.type === 'Polygon') {
    const coords = geometry.coordinates as number[][][];
    if (Array.isArray(coords) && Array.isArray(coords[0])) {
      rawRings.push(coords[0]);
    }
  } else if (geometry.type === 'MultiPolygon') {
    const polys = geometry.coordinates as number[][][][];
    if (Array.isArray(polys)) {
      // Keep largest rings first if a country has hundreds of tiny slivers
      const outerCandidates = polys
        .map((p) => (Array.isArray(p) && Array.isArray(p[0]) ? p[0] : []))
        .filter((r) => r.length >= 4)
        .sort((a, b) => b.length - a.length)
        .slice(0, maxRingsPerFeature);
      for (const r of outerCandidates) {
        rawRings.push(r);
      }
    }
  }

  const out: number[][][] = [];
  for (const r of rawRings) {
    const simp = simplifyRing(r, maxPointsPerRing);
    if (simp.length >= 4) {
      out.push(simp);
    }
  }
  return out;
}

export function pointInRing(lon: number, lat: number, ring: number[][]): boolean {
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

export function pointInFeature(lon: number, lat: number, f: SimplePolygonFeature): boolean {
  const [minLon, minLat, maxLon, maxLat] = f.bbox;
  if (lon < minLon || lon > maxLon || lat < minLat || lat > maxLat) return false;
  return f.rings.some((ring) => pointInRing(lon, lat, ring));
}

function normalizeGeoDisplayName(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  // Convert ALL-CAPS Natural Earth labels like "HAWAIIAN ISLANDS" to clean Title Case
  const letters = trimmed.replace(/[^a-zA-ZÀ-ÿ]/g, '');
  if (letters.length > 3 && letters === letters.toUpperCase()) {
    return trimmed
      .toLowerCase()
      .replace(/(^|\s|-)([a-zà-ÿ])/g, (m, sep, ch) => `${sep}${ch.toUpperCase()}`)
      .replace(/\b(De|Del|La|Las|Los|Of|And|The|Y)\b/g, (w) => w.toLowerCase());
  }
  return trimmed;
}

function inferOceanFromCoord(lat: number, lon: number, regionHint = ''): string {
  const hint = regionHint.toLowerCase();
  if (hint.includes('mediterranean')) return 'Mediterranean Sea';
  if (hint.includes('caribbean')) return 'Caribbean Sea · Atlantic Ocean';
  if (hint.includes('indian ocean')) return 'Indian Ocean';
  if (hint.includes('north atlantic') || hint.includes('south atlantic')) return 'Atlantic Ocean';
  if (
    hint.includes('pacific') ||
    hint.includes('polynesia') ||
    hint.includes('melanesia') ||
    hint.includes('micronesia')
  ) {
    return 'Pacific Ocean';
  }
  if (hint.includes('arctic')) return 'Arctic Ocean';
  if (hint.includes('antarctic') || hint.includes('southern ocean')) return 'Southern Ocean';

  if (lat >= 66.5) return 'Arctic Ocean';
  if (lat <= -60) return 'Southern Ocean';
  if (lon >= 20 && lon <= 120 && lat <= 30) return 'Indian Ocean';
  if (lon > -72 && lon < 20) return 'Atlantic Ocean';
  return 'Pacific Ocean';
}

// -----------------------------------------------------------------------------
// 1. Countries & Territories Vector Layer (world-atlas + world-countries)
// -----------------------------------------------------------------------------
export function getCountriesLayer(detail: GeoDetailLevel = '110m'): SimplePolygonFeature[] {
  const cached = countryLayerCache.get(detail);
  if (cached) return cached;

  const filePath = require.resolve(`world-atlas/countries-${detail}.json`);
  const topo = require(filePath);
  const fc = topojsonClient.feature(topo, topo.objects.countries) as unknown as {
    type: 'FeatureCollection';
    features: Array<{
      id?: string | number;
      properties?: { name?: string };
      geometry: { type: string; coordinates: unknown } | null;
    }>;
  };

  const maxPts = detail === '110m' ? 140 : detail === '50m' ? 220 : 300;
  const maxRings = detail === '110m' ? 16 : 28;

  const features: SimplePolygonFeature[] = [];
  for (let i = 0; i < fc.features.length; i++) {
    const feat = fc.features[i];
    const rings = extractOuterRingsFromGeometry(feat.geometry, maxPts, maxRings);
    if (rings.length === 0) continue;

    const rawId = feat.id !== undefined ? String(feat.id) : '';
    const paddedId = rawId ? rawId.padStart(3, '0') : '';
    const propName = String(feat.properties?.name ?? '').trim();
    const meta =
      (paddedId ? META_BY_CCN3.get(paddedId) : undefined) ??
      (rawId ? META_BY_CCN3.get(rawId) : undefined) ??
      (propName ? META_BY_NAME.get(propName.toLowerCase()) : undefined);

    const stats = computeRingStats(rings);
    const name = meta?.name ?? (propName || `Territory ${rawId || i + 1}`);
    const lat = meta ? meta.lat : stats.lat;
    const lon = meta ? meta.lon : stats.lon;

    features.push({
      id: `country-${meta?.iso3 ?? (paddedId || i)}`,
      name,
      officialName: meta?.officialName ?? name,
      level: 'country',
      levelLabel: meta?.isTerritory ? 'Territory / Dependency' : 'Country',
      iso2: meta?.iso2,
      iso3: meta?.iso3,
      ccn3: meta?.ccn3 ?? paddedId,
      altSpellings: meta?.altSpellings,
      continent: meta?.continent ?? 'Earth',
      subregion: meta?.subregion ?? '',
      capital: meta?.capital ?? 'Data Unavailable',
      flag: meta?.flag ?? '',
      areaKm2: meta?.areaKm2 ?? null,
      population: null,
      isTerritory: meta?.isTerritory ?? false,
      lat,
      lon,
      bbox: stats.bbox,
      rings,
      datasetSource: `Natural Earth (${detail}) via world-atlas + world-countries`,
      datasetLicense: 'Public Domain (Natural Earth) / ODbL',
      boundaryAvailable: true,
    });
  }

  countryLayerCache.set(detail, features);
  return features;
}

// -----------------------------------------------------------------------------
// 2. Country Profile & ADM1 Gazetteer (country-state-city + world-countries)
// -----------------------------------------------------------------------------
export function getCountryProfile(iso3OrCode: string) {
  const key = iso3OrCode.trim().toUpperCase();
  const meta =
    META_BY_ISO3.get(key) ??
    META_BY_ISO2.get(key) ??
    META_BY_NAME.get(iso3OrCode.trim().toLowerCase());

  if (!meta) return null;

  const states = State.getStatesOfCountry(meta.iso2).map((s) => {
    const cities = City.getCitiesOfState(meta.iso2, s.isoCode);
    return {
      name: s.name,
      stateCode: s.isoCode,
      lat: Number(s.latitude) || meta.lat,
      lon: Number(s.longitude) || meta.lon,
      cityCount: cities.length,
    };
  });

  const cscCountry = ALL_CSC_COUNTRIES.find((c) => c.isoCode === meta.iso2);
  const allCitiesCount = City.getCitiesOfCountry(meta.iso2)?.length ?? 0;

  return {
    ...meta,
    phonecode: cscCountry?.phonecode ?? '',
    currency: cscCountry?.currency ?? '',
    states,
    citiesCount: allCitiesCount,
  };
}

// -----------------------------------------------------------------------------
// 3. Real Administrative Boundaries (ADM1 / ADM2 / ADM3) via geoBoundaries
// -----------------------------------------------------------------------------
const GEO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 AquaGuardAI/1.0 (https://geoboundaries.org open educational client)',
  Accept: 'application/json',
};

export async function getAdminBoundaries(
  iso3Raw: string,
  level: GeoAdminLevel,
  filter?: {
    parentName?: string;
    parentLevel?: GeoAdminLevel;
    parentBbox?: [number, number, number, number];
  }
): Promise<GeoBoundaryResponse> {
  const iso3 = iso3Raw.trim().toUpperCase();
  const cacheKey = `${iso3}:${level}`;

  let entry = rawAdmCache.get(cacheKey);
  if (!entry) {
    try {
      const metaUrl = `https://www.geoboundaries.org/api/current/gbOpen/${encodeURIComponent(iso3)}/${level}/`;
      const metaRes = await fetch(metaUrl, {
        headers: GEO_HEADERS,
        signal: AbortSignal.timeout(12000),
      });

      if (!metaRes.ok) {
        entry = {
          available: false,
          boundaryCanonical: level,
          boundarySource: 'geoBoundaries Open',
          boundaryLicense: 'Unavailable',
          boundaryYear: 'Unavailable',
          admUnitCount: 0,
          reason: `Boundary Unavailable: geoBoundaries has no open ${level} layer for ${iso3} (HTTP ${metaRes.status}).`,
          features: [],
        };
        rawAdmCache.set(cacheKey, entry);
      } else {
        const metaJson = (await metaRes.json()) as {
          boundaryCanonical?: string;
          boundarySource?: string;
          boundaryLicense?: string;
          boundaryYearRepresented?: string;
          admUnitCount?: string | number;
          tjDownloadURL?: string;
          simplifiedGeometryGeoJSON?: string;
        };

        const boundaryCanonical =
          metaJson.boundaryCanonical ||
          (level === 'ADM1' ? 'State / Province' : level === 'ADM2' ? 'District / County' : 'Local Division');
        const boundarySource = metaJson.boundarySource || 'geoBoundaries Open';
        const boundaryLicense = metaJson.boundaryLicense || 'Open License';
        const boundaryYear = String(metaJson.boundaryYearRepresented ?? 'Latest Open Release');
        const admUnitCount = Number(metaJson.admUnitCount ?? 0) || 0;

        interface RawGeoFeatureCollection {
          features?: Array<{
            properties?: Record<string, unknown>;
            geometry?: { type?: string; coordinates?: unknown } | null;
          }>;
        }
        let fc: RawGeoFeatureCollection | null = null;

        // Prefer lighter TopoJSON URL first, fallback to simplified GeoJSON
        if (metaJson.tjDownloadURL) {
          try {
            const tjRes = await fetch(metaJson.tjDownloadURL, {
              headers: GEO_HEADERS,
              signal: AbortSignal.timeout(16000),
            });
            if (tjRes.ok) {
              const tj = (await tjRes.json()) as {
                objects?: Record<string, unknown>;
              };
              const objKey = tj.objects ? Object.keys(tj.objects)[0] : undefined;
              if (objKey && tj.objects) {
                fc = topojsonClient.feature(
                  tj as unknown as Parameters<typeof topojsonClient.feature>[0],
                  tj.objects[objKey] as Parameters<typeof topojsonClient.feature>[1]
                ) as unknown as RawGeoFeatureCollection;
              }
            }
          } catch {
            // Fallback below
          }
        }

        if (!fc && metaJson.simplifiedGeometryGeoJSON) {
          const gjRes = await fetch(metaJson.simplifiedGeometryGeoJSON, {
            headers: GEO_HEADERS,
            signal: AbortSignal.timeout(18000),
          });
          if (gjRes.ok) {
            fc = (await gjRes.json()) as RawGeoFeatureCollection;
          }
        }

        if (!fc || !Array.isArray(fc.features) || fc.features.length === 0) {
          entry = {
            available: false,
            boundaryCanonical,
            boundarySource,
            boundaryLicense,
            boundaryYear,
            admUnitCount,
            reason: `Boundary geometry download unavailable or timed out for ${iso3} ${level}.`,
            features: [],
          };
          rawAdmCache.set(cacheKey, entry);
        } else {
          const countryMeta = META_BY_ISO3.get(iso3);
          const featureCount = fc.features.length;
          const maxPts = featureCount > 350 ? 45 : featureCount > 100 ? 80 : 140;
          const maxRings = featureCount > 350 ? 4 : 10;

          const parsed: SimplePolygonFeature[] = [];
          for (let i = 0; i < fc.features.length; i++) {
            const rawF = fc.features[i];
            const props = rawF.properties ?? {};
            const rings = extractOuterRingsFromGeometry(rawF.geometry, maxPts, maxRings);
            if (rings.length === 0) continue;
            const stats = computeRingStats(rings);
            const shapeName = String(props.shapeName ?? props.name ?? `Unit ${i + 1}`).trim();
            const shapeId = String(props.shapeID ?? `${iso3}-${level}-${i}`);

            parsed.push({
              id: `${iso3.toLowerCase()}-${level.toLowerCase()}-${shapeId}`,
              name: shapeName,
              level: level.toLowerCase() as 'adm1' | 'adm2' | 'adm3',
              levelLabel: boundaryCanonical,
              iso2: countryMeta?.iso2,
              iso3,
              stateCode: typeof props.shapeISO === 'string' ? props.shapeISO : undefined,
              continent: countryMeta?.continent,
              countryOrTerritory: countryMeta?.name ?? iso3,
              lat: stats.lat,
              lon: stats.lon,
              bbox: stats.bbox,
              rings,
              datasetSource: `geoBoundaries (${boundarySource})`,
              datasetYear: boundaryYear,
              datasetLicense: boundaryLicense,
              boundaryAvailable: true,
            });
          }

          entry = {
            available: parsed.length > 0,
            boundaryCanonical,
            boundarySource,
            boundaryLicense,
            boundaryYear,
            admUnitCount: admUnitCount || parsed.length,
            features: parsed,
          };
          rawAdmCache.set(cacheKey, entry);
        }
      }
    } catch (err) {
      entry = {
        available: false,
        boundaryCanonical: level,
        boundarySource: 'geoBoundaries Open',
        boundaryLicense: 'Unavailable',
        boundaryYear: 'Unavailable',
        admUnitCount: 0,
        reason: `Boundary Unavailable (${err instanceof Error ? err.message : 'network error'}).`,
        features: [],
      };
      // Only briefly skip caching transient network failures, or cache so UI stays responsive
    }
  }

  if (!entry) {
    return {
      available: false,
      iso3,
      level,
      boundaryCanonical: level,
      boundarySource: 'geoBoundaries Open',
      boundaryLicense: 'Unavailable',
      boundaryYear: 'Unavailable',
      admUnitCount: 0,
      reason: 'Boundary Unavailable.',
      features: [],
    };
  }

  let filteredFeatures = entry.features;

  // Spatial filter to parent division (so Kerala loads Kerala districts, not all 735 India districts)
  if (entry.available && filter && (filter.parentName || filter.parentBbox)) {
    let parentFeature: SimplePolygonFeature | undefined;
    if (filter.parentName && filter.parentLevel) {
      const parentEntry = rawAdmCache.get(`${iso3}:${filter.parentLevel}`);
      if (parentEntry?.available) {
        const needle = filter.parentName.toLowerCase().trim();
        parentFeature =
          parentEntry.features.find((f) => f.name.toLowerCase().trim() === needle) ??
          parentEntry.features.find((f) => f.name.toLowerCase().includes(needle));
      }
    }

    if (parentFeature) {
      const exactInside = entry.features.filter((child) =>
        pointInFeature(child.lon, child.lat, parentFeature!)
      );
      if (exactInside.length > 0) {
        filteredFeatures = exactInside;
      } else {
        const [pMinLon, pMinLat, pMaxLon, pMaxLat] = parentFeature.bbox;
        filteredFeatures = entry.features.filter(
          (c) =>
            c.lon >= pMinLon - 0.15 &&
            c.lon <= pMaxLon + 0.15 &&
            c.lat >= pMinLat - 0.15 &&
            c.lat <= pMaxLat + 0.15
        );
      }
    } else if (filter.parentBbox) {
      const [pMinLon, pMinLat, pMaxLon, pMaxLat] = filter.parentBbox;
      const insideBox = entry.features.filter(
        (c) => c.lon >= pMinLon && c.lon <= pMaxLon && c.lat >= pMinLat && c.lat <= pMaxLat
      );
      if (insideBox.length > 0) {
        filteredFeatures = insideBox;
      }
    }
  }

  return {
    available: entry.available,
    iso3,
    level,
    boundaryCanonical: entry.boundaryCanonical,
    boundarySource: entry.boundarySource,
    boundaryLicense: entry.boundaryLicense,
    boundaryYear: entry.boundaryYear,
    admUnitCount: entry.admUnitCount,
    reason: entry.reason,
    features: filteredFeatures,
  };
}

// -----------------------------------------------------------------------------
// 4. Real Cities / Towns / Villages (country-state-city)
// -----------------------------------------------------------------------------
export function getPlaces(params: {
  iso2?: string;
  stateCode?: string;
  bbox?: [number, number, number, number];
  q?: string;
  limit?: number;
}) {
  const limit = Math.min(200, Math.max(10, params.limit ?? 80));
  const iso2 = params.iso2?.trim().toUpperCase();
  const stateCode = params.stateCode?.trim().toUpperCase();
  const q = params.q?.trim().toLowerCase() ?? '';

  let list =
    iso2 && stateCode
      ? City.getCitiesOfState(iso2, stateCode)
      : iso2
        ? City.getCitiesOfCountry(iso2) ?? []
        : ALL_CITIES;

  if (params.bbox) {
    const [minLon, minLat, maxLon, maxLat] = params.bbox;
    list = list.filter((c) => {
      const lat = Number(c.latitude);
      const lon = Number(c.longitude);
      return Number.isFinite(lat) && Number.isFinite(lon) && lon >= minLon && lon <= maxLon && lat >= minLat && lat <= maxLat;
    });
  }

  if (q) {
    list = list.filter((c) => c.name.toLowerCase().includes(q));
  }

  return list.slice(0, limit).map((c) => ({
    id: `city-${c.countryCode}-${c.stateCode}-${c.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
    name: c.name,
    countryCode: c.countryCode,
    stateCode: c.stateCode,
    lat: Number(c.latitude) || 0,
    lon: Number(c.longitude) || 0,
    datasetSource: 'country-state-city Gazetteer',
  }));
}

// -----------------------------------------------------------------------------
// 5. Real Islands & Archipelagos (Natural Earth 10m + world-countries)
// -----------------------------------------------------------------------------
export async function getIslandsLayer(params?: {
  ocean?: string;
  q?: string;
}): Promise<SimplePolygonFeature[]> {
  if (!cachedIslands) {
    if (!islandsLoadPromise) {
      islandsLoadPromise = (async () => {
        const features: SimplePolygonFeature[] = [];
        const seenNames = new Set<string>();

        try {
          const url =
            'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_geography_regions_polys.geojson';
          const res = await fetch(url, { signal: AbortSignal.timeout(18000) });
          if (res.ok) {
            const gj = (await res.json()) as {
              features?: Array<{
                properties?: {
                  NAME?: string;
                  NAMEALT?: string;
                  FEATURECLA?: string;
                  REGION?: string;
                  SUBREGION?: string;
                };
                geometry?: { type?: string; coordinates?: unknown } | null;
              }>;
            };

            const rawFeatures = gj.features ?? [];
            for (let i = 0; i < rawFeatures.length; i++) {
              const rawF = rawFeatures[i];
              const fcla = String(rawF.properties?.FEATURECLA ?? '');
              if (fcla !== 'Island' && fcla !== 'Island group') continue;

              const rawName = String(rawF.properties?.NAME ?? '').trim();
              if (!rawName) continue;
              const name = normalizeGeoDisplayName(rawName);
              const rings = extractOuterRingsFromGeometry(rawF.geometry, 95, 14);
              if (rings.length === 0) continue;

              const stats = computeRingStats(rings);
              const kind = fcla === 'Island group' ? 'archipelago' : 'island';
              const regionText = String(rawF.properties?.REGION ?? '').trim();
              const subregionText = String(rawF.properties?.SUBREGION ?? '').trim();
              const ocean = inferOceanFromCoord(stats.lat, stats.lon, `${regionText} ${subregionText}`);
              const matchedNation = META_BY_NAME.get(name.toLowerCase());
              seenNames.add(name.toLowerCase());

              features.push({
                id: `${kind}-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${i}`,
                name,
                officialName: matchedNation?.officialName ?? name,
                altSpellings: rawF.properties?.NAMEALT
                  ? String(rawF.properties.NAMEALT)
                      .split('|')
                      .map((s) => s.trim())
                  : undefined,
                level: kind,
                levelLabel: kind === 'archipelago' ? 'Archipelago / Island Group' : 'Island',
                iso2: matchedNation?.iso2,
                iso3: matchedNation?.iso3,
                flag: matchedNation?.flag ?? '',
                capital: matchedNation?.capital,
                areaKm2: matchedNation?.areaKm2 ?? null,
                population: null,
                ocean,
                islandRegion: subregionText || regionText || ocean,
                countryOrTerritory: matchedNation?.name ?? (regionText || 'International / Sovereign'),
                lat: stats.lat,
                lon: stats.lon,
                bbox: stats.bbox,
                rings,
                datasetSource: 'Natural Earth 10m Physical Geography Polygons',
                datasetLicense: 'Public Domain (Natural Earth)',
                boundaryAvailable: true,
              });
            }
          }
        } catch {
          // Graceful fallback to island nations & territories below if network offline
        }

        // Also enrich with sovereign island nations & island territories from world-countries + 50m/110m boundaries
        const countries50 = getCountriesLayer('50m');
        const polyByIso3 = new Map<string, SimplePolygonFeature>();
        for (const c of countries50) {
          if (c.iso3) polyByIso3.set(c.iso3, c);
        }

        for (const meta of COUNTRY_META_LIST) {
          if (!meta.isIslandNationOrTerritory) continue;
          if (seenNames.has(meta.name.toLowerCase())) continue;

          const poly = polyByIso3.get(meta.iso3);
          const ocean = inferOceanFromCoord(meta.lat, meta.lon, `${meta.continent} ${meta.subregion}`);

          features.push({
            id: `island-nation-${meta.iso3.toLowerCase()}`,
            name: meta.name,
            officialName: meta.officialName,
            altSpellings: meta.altSpellings,
            level: 'island',
            levelLabel: meta.isTerritory ? 'Island Territory' : 'Island Country',
            iso2: meta.iso2,
            iso3: meta.iso3,
            ccn3: meta.ccn3,
            flag: meta.flag,
            capital: meta.capital,
            areaKm2: meta.areaKm2,
            population: null,
            isTerritory: meta.isTerritory,
            ocean,
            islandRegion: meta.subregion || meta.continent,
            countryOrTerritory: meta.name,
            lat: meta.lat,
            lon: meta.lon,
            bbox: poly?.bbox ?? [meta.lon - 0.5, meta.lat - 0.5, meta.lon + 0.5, meta.lat + 0.5],
            rings: poly?.rings ?? [],
            datasetSource: poly
              ? 'Natural Earth (50m) + world-countries'
              : 'world-countries Gazetteer (Boundary Unavailable at 50m)',
            datasetLicense: 'Public Domain / ODbL',
            boundaryAvailable: Boolean(poly && poly.rings.length > 0),
          });
        }

        cachedIslands = features;
        return features;
      })();
    }
    await islandsLoadPromise;
  }

  let list = cachedIslands ?? [];
  if (params?.ocean) {
    const o = params.ocean.toLowerCase();
    list = list.filter((i) => (i.ocean ?? '').toLowerCase().includes(o));
  }
  if (params?.q) {
    const q = params.q.toLowerCase();
    list = list.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        (i.altSpellings ?? []).some((a) => a.toLowerCase().includes(q)) ||
        (i.ocean ?? '').toLowerCase().includes(q)
    );
  }
  return list;
}

export async function getMinorIslandsInBbox(bbox: [number, number, number, number]): Promise<SimplePolygonFeature[]> {
  if (!cachedMinorIslands) {
    if (!minorIslandsLoadPromise) {
      minorIslandsLoadPromise = (async () => {
        const list: SimplePolygonFeature[] = [];
        try {
          const url =
            'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_10m_minor_islands.geojson';
          const res = await fetch(url, { signal: AbortSignal.timeout(18000) });
          if (res.ok) {
            const gj = (await res.json()) as {
              features?: Array<{
                geometry?: { type?: string; coordinates?: unknown } | null;
              }>;
            };
            const raw = gj.features ?? [];
            for (let i = 0; i < raw.length; i++) {
              const rings = extractOuterRingsFromGeometry(raw[i].geometry, 48, 4);
              if (rings.length === 0) continue;
              const stats = computeRingStats(rings);
              list.push({
                id: `minor-island-${i}`,
                name: `Unlabeled Minor Island (${stats.lat.toFixed(2)}°, ${stats.lon.toFixed(2)}°)`,
                level: 'minor-island',
                levelLabel: 'Coastal / Minor Island Coastline',
                ocean: inferOceanFromCoord(stats.lat, stats.lon),
                lat: stats.lat,
                lon: stats.lon,
                bbox: stats.bbox,
                rings,
                datasetSource: 'Natural Earth 10m Minor Islands (Geometry Only)',
                datasetLicense: 'Public Domain (Natural Earth)',
                boundaryAvailable: true,
              });
            }
          }
        } catch {
          // Return empty list gracefully if offline
        }
        cachedMinorIslands = list;
        return list;
      })();
    }
    await minorIslandsLoadPromise;
  }

  const [minLon, minLat, maxLon, maxLat] = bbox;
  return (cachedMinorIslands ?? [])
    .filter(
      (m) =>
        m.bbox[2] >= minLon &&
        m.bbox[0] <= maxLon &&
        m.bbox[3] >= minLat &&
        m.bbox[1] <= maxLat
    )
    .slice(0, 260);
}

// -----------------------------------------------------------------------------
// 6. Unified Global Geography Search (Countries, States, Districts, Cities, Islands)
// -----------------------------------------------------------------------------
export async function searchGeography(qRaw: string, limit = 16): Promise<GeoSearchItem[]> {
  const q = qRaw.trim().toLowerCase();
  if (!q) return [];

  const exact: GeoSearchItem[] = [];
  const prefix: GeoSearchItem[] = [];
  const partial: GeoSearchItem[] = [];

  const pushRanked = (item: GeoSearchItem, searchTerms: string[]) => {
    const cleanTerms = searchTerms.map((t) => t.toLowerCase());
    if (cleanTerms.some((t) => t === q)) {
      exact.push(item);
    } else if (cleanTerms.some((t) => t.startsWith(q))) {
      prefix.push(item);
    } else {
      partial.push(item);
    }
  };

  // A. Countries & Territories (250)
  for (const meta of COUNTRY_META_LIST) {
    const terms = [meta.name, meta.officialName, meta.iso2, meta.iso3, meta.capital, ...meta.altSpellings];
    if (terms.some((t) => t.toLowerCase().includes(q))) {
      pushRanked(
        {
          id: `country-${meta.iso3}`,
          name: meta.name,
          officialName: meta.officialName,
          category: meta.isTerritory ? 'Territory' : 'Country',
          level: 'country',
          levelLabel: meta.isTerritory ? 'Territory / Dependency' : 'Country',
          hierarchyLabel: `Earth → ${meta.continent} → ${meta.name}`,
          iso2: meta.iso2,
          iso3: meta.iso3,
          flag: meta.flag,
          countryOrTerritory: meta.name,
          lat: meta.lat,
          lon: meta.lon,
          boundaryAvailable: true,
          datasetSource: 'Natural Earth + world-countries',
        },
        terms
      );
    }
  }

  // B. Islands & Archipelagos (Natural Earth 10m + Island Nations)
  // Trigger/await islands load with short graceful fallback if first search
  let islands: SimplePolygonFeature[] = cachedIslands ?? [];
  if (!cachedIslands) {
    try {
      islands = await Promise.race([
        getIslandsLayer(),
        new Promise<SimplePolygonFeature[]>((resolve) => setTimeout(() => resolve([]), 3500)),
      ]);
    } catch {
      islands = [];
    }
  }
  for (const isl of islands) {
    const terms = [isl.name, isl.officialName ?? '', ...(isl.altSpellings ?? [])].filter(Boolean);
    if (terms.some((t) => t.toLowerCase().includes(q))) {
      pushRanked(
        {
          id: isl.id,
          name: isl.name,
          officialName: isl.officialName,
          category: isl.level === 'archipelago' ? 'Archipelago' : 'Island',
          level: isl.level === 'archipelago' ? 'archipelago' : 'island',
          levelLabel: isl.levelLabel,
          hierarchyLabel: `Earth → ${isl.ocean ?? 'Ocean'} → ${isl.islandRegion ?? 'Island Region'} → ${isl.name}`,
          iso2: isl.iso2,
          iso3: isl.iso3,
          flag: isl.flag,
          ocean: isl.ocean,
          countryOrTerritory: isl.countryOrTerritory,
          lat: isl.lat,
          lon: isl.lon,
          boundaryAvailable: isl.boundaryAvailable,
          datasetSource: isl.datasetSource,
        },
        terms
      );
    }
  }

  // C. States / Provinces / First-Level Divisions (4,963)
  let adm1Matches = 0;
  for (const st of ALL_STATES) {
    if (st.name.toLowerCase().includes(q)) {
      const country = META_BY_ISO2.get(st.countryCode);
      pushRanked(
        {
          id: `adm1-${country?.iso3 ?? st.countryCode}-${st.isoCode}`,
          name: st.name,
          category: 'State / Province',
          level: 'adm1',
          levelLabel: 'State / Province / Region',
          hierarchyLabel: `Earth → ${country?.continent ?? 'Continent'} → ${country?.name ?? st.countryCode} → ${st.name}`,
          iso2: st.countryCode,
          iso3: country?.iso3,
          stateCode: st.isoCode,
          flag: country?.flag,
          countryOrTerritory: country?.name ?? st.countryCode,
          lat: Number(st.latitude) || country?.lat || 0,
          lon: Number(st.longitude) || country?.lon || 0,
          boundaryAvailable: Boolean(country?.iso3),
          datasetSource: 'country-state-city + geoBoundaries Open',
        },
        [st.name]
      );
      adm1Matches++;
      if (adm1Matches >= 40) break;
    }
  }

  // D. Cached ADM2 / ADM3 boundaries (Districts / Counties / Local Divisions already loaded)
  for (const [key, cacheEntry] of rawAdmCache.entries()) {
    if (!cacheEntry.available) continue;
    const [, lvl] = key.split(':');
    if (lvl !== 'ADM2' && lvl !== 'ADM3') continue;
    for (const f of cacheEntry.features) {
      if (f.name.toLowerCase().includes(q)) {
        const country = f.iso3 ? META_BY_ISO3.get(f.iso3) : undefined;
        pushRanked(
          {
            id: f.id,
            name: f.name,
            category: lvl === 'ADM2' ? 'District / County' : 'Local Division',
            level: lvl === 'ADM2' ? 'adm2' : 'adm3',
            levelLabel: f.levelLabel,
            hierarchyLabel: `Earth → ${country?.continent ?? 'Region'} → ${country?.name ?? f.iso3 ?? ''} → ${f.name}`,
            iso2: country?.iso2,
            iso3: f.iso3,
            flag: country?.flag,
            countryOrTerritory: country?.name ?? f.iso3,
            lat: f.lat,
            lon: f.lon,
            boundaryAvailable: true,
            datasetSource: f.datasetSource,
          },
          [f.name]
        );
      }
    }
  }

  // E. Cities / Towns / Villages (148,038)
  if (q.length >= 2) {
    let cityMatches = 0;
    for (let i = 0; i < ALL_CITIES.length; i++) {
      const c = ALL_CITIES[i];
      if (c.name.toLowerCase().includes(q)) {
        const country = META_BY_ISO2.get(c.countryCode);
        const stateObj = ALL_STATES.find(
          (s) => s.countryCode === c.countryCode && s.isoCode === c.stateCode
        );
        pushRanked(
          {
            id: `city-${c.countryCode}-${c.stateCode}-${c.name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'),
            name: c.name,
            category: 'City / Town',
            level: 'city',
            levelLabel: 'City / Town / Settlement',
            hierarchyLabel: `Earth → ${country?.name ?? c.countryCode} → ${stateObj?.name ?? c.stateCode} → ${c.name}`,
            iso2: c.countryCode,
            iso3: country?.iso3,
            stateCode: c.stateCode,
            flag: country?.flag,
            countryOrTerritory: country?.name ?? c.countryCode,
            lat: Number(c.latitude) || country?.lat || 0,
            lon: Number(c.longitude) || country?.lon || 0,
            boundaryAvailable: false,
            datasetSource: 'country-state-city Gazetteer',
          },
          [c.name]
        );
        cityMatches++;
        if (cityMatches >= 30 && exact.length + prefix.length >= limit) break;
      }
    }
  }

  const combined = [...exact, ...prefix, ...partial];
  const deduped: GeoSearchItem[] = [];
  const seen = new Set<string>();
  for (const item of combined) {
    const key = `${item.level}:${item.name.toLowerCase()}:${item.iso3 ?? item.ocean ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
    if (deduped.length >= limit) break;
  }
  return deduped;
}

// -----------------------------------------------------------------------------
// 7. Honest Dynamic Global Coverage Statistics
// -----------------------------------------------------------------------------
export function getCoverageStats(): GeoCoveragePayload {
  const countriesCount = COUNTRY_META_LIST.filter((c) => !c.isTerritory).length;
  const territoriesCount = COUNTRY_META_LIST.filter((c) => c.isTerritory).length;

  const countries110m = countryLayerCache.get('110m')?.length ?? getCountriesLayer('110m').length;
  const countries50m = countryLayerCache.get('50m')?.length ?? 0;

  let adm1Countries = 0;
  let adm1Polygons = 0;
  let adm2Countries = 0;
  let adm2Polygons = 0;
  let adm3Countries = 0;
  let adm3Polygons = 0;

  for (const [key, entry] of rawAdmCache.entries()) {
    if (!entry.available) continue;
    if (key.endsWith(':ADM1')) {
      adm1Countries++;
      adm1Polygons += entry.features.length;
    } else if (key.endsWith(':ADM2')) {
      adm2Countries++;
      adm2Polygons += entry.features.length;
    } else if (key.endsWith(':ADM3')) {
      adm3Countries++;
      adm3Polygons += entry.features.length;
    }
  }

  const islandsMappedCount = (cachedIslands ?? []).filter((i) => i.level === 'island').length;
  const archipelagosMappedCount = (cachedIslands ?? []).filter(
    (i) => i.level === 'archipelago'
  ).length;
  const minorIslandsLoadedCount = cachedMinorIslands?.length ?? 0;

  const totalPolygonsLoadedInMemory =
    countries110m +
    adm1Polygons +
    adm2Polygons +
    adm3Polygons +
    islandsMappedCount +
    archipelagosMappedCount +
    minorIslandsLoadedCount;

  return {
    generatedAt: Date.now(),
    countriesCount,
    territoriesCount,
    totalCountriesAndTerritories: COUNTRY_META_LIST.length,
    countries110mMapped: countries110m,
    countries50mMapped: countries50m,
    adm1GazetteerCount: ALL_STATES.length,
    citiesIndexedCount: ALL_CITIES.length,
    adm1BoundaryCountriesLoaded: adm1Countries,
    adm1BoundaryPolygonsLoaded: adm1Polygons,
    adm2BoundaryCountriesLoaded: adm2Countries,
    adm2BoundaryPolygonsLoaded: adm2Polygons,
    adm3BoundaryCountriesLoaded: adm3Countries,
    adm3BoundaryPolygonsLoaded: adm3Polygons,
    islandsMappedCount,
    archipelagosMappedCount,
    minorIslandsLoadedCount,
    totalPolygonsLoadedInMemory,
    datasets: [
      {
        name: 'world-countries (ISO 3166 + Metadata)',
        scope: 'World Countries & Territories',
        status: 'Loaded',
        coverageText: `${countriesCount} countries + ${territoriesCount} territories (${COUNTRY_META_LIST.length} total)`,
        license: 'ODbL',
      },
      {
        name: 'Natural Earth via world-atlas (110m / 50m / 10m)',
        scope: 'Global Country & Territory Polygons',
        status: 'Loaded',
        coverageText: `${countries110m} polygons at 110m; ${countries50m > 0 ? `${countries50m} at 50m` : '50m/10m loaded on zoom'}`,
        license: 'Public Domain',
      },
      {
        name: 'country-state-city Gazetteer',
        scope: 'States, Provinces & Settlements',
        status: 'Loaded',
        coverageText: `${ALL_STATES.length.toLocaleString()} ADM1 states/provinces · ${ALL_CITIES.length.toLocaleString()} cities/towns`,
        license: 'MIT Open Dataset',
      },
      {
        name: 'geoBoundaries Open API (ADM1 / ADM2 / ADM3)',
        scope: 'Sub-National Administrative Polygons',
        status: 'Partial / Country-Dependent',
        coverageText:
          adm1Countries + adm2Countries + adm3Countries > 0
            ? `${adm1Polygons} ADM1 (${adm1Countries} countries) · ${adm2Polygons} ADM2 (${adm2Countries}) · ${adm3Polygons} ADM3 (${adm3Countries})`
            : 'Fetched lazily per selected country; missing levels show Boundary Unavailable',
        license: 'Open (CC-BY / CC0 / ODbL per nation)',
      },
      {
        name: 'Natural Earth 10m Geography Polys & Minor Islands',
        scope: 'Islands, Archipelagos & Coastal Outlines',
        status: cachedIslands ? 'Loaded' : 'Loaded on Demand',
        coverageText: cachedIslands
          ? `${islandsMappedCount} islands + ${archipelagosMappedCount} archipelagos${minorIslandsLoadedCount ? ` + ${minorIslandsLoadedCount} minor outlines` : ''}`
          : 'Loaded dynamically when opening Island Explorer or searching islands',
        license: 'Public Domain',
      },
    ],
  };
}
