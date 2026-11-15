import React, { useEffect, useMemo, useState } from 'react';
import {
  Anchor,
  ArrowLeft,
  BarChart3,
  Building2,
  ChevronRight,
  Compass,
  Database,
  Globe,
  Info,
  Layers,
  Loader2,
  MapPin,
  ShieldCheck,
  X,
} from 'lucide-react';
import {
  EARTH_OVERLAYS,
  EARTH_REGIONS,
  GLOBAL_WATER_BUDGET,
} from '../data/earthWaterData';
import {
  GeoBoundaryPayload,
  GeoCountryProfile,
  GeoCoveragePayload,
  GeoPlaceEntry,
  buildSelectedGeographyFromFeature,
  computeRecommendedDistanceForBbox,
  fetchAdminBoundaries,
  fetchCountriesLayer,
  fetchCountryProfile,
  fetchGeoCoverage,
  fetchIslandsLayer,
  fetchPlaces,
} from '../services/geoClient';
import { useAppState } from '../state/appStore';
import {
  GeoBreadcrumbNode,
  GeoPolygonFeature,
  SelectedGeographyNode,
} from '../types/exhibition';

function formatCoord(val: number, posHem: string, negHem: string): string {
  return `${Math.abs(val).toFixed(2)}° ${val >= 0 ? posHem : negHem}`;
}

const CONTINENTS = [
  'All',
  'Asia',
  'Europe',
  'Africa',
  'North America',
  'South America',
  'Oceania',
  'Antarctica',
];

const OCEANS = [
  'All Oceans',
  'Pacific Ocean',
  'Atlantic Ocean',
  'Indian Ocean',
  'Arctic Ocean',
  'Southern Ocean',
  'Caribbean',
  'Mediterranean',
];

export const EarthInfoPanel: React.FC = () => {
  const { state, dispatchAction, focusRegion } = useAppState();

  // Dynamic Stage 2 explorer state
  const [allCountries, setAllCountries] = useState<GeoPolygonFeature[]>([]);
  const [continentFilter, setContinentFilter] = useState('All');
  const [countryFilterQuery, setCountryFilterQuery] = useState('');

  const [allIslands, setAllIslands] = useState<GeoPolygonFeature[]>([]);
  const [islandsLoading, setIslandsLoading] = useState(false);
  const [oceanFilter, setOceanFilter] = useState('All Oceans');
  const [islandFilterQuery, setIslandFilterQuery] = useState('');

  const [coverageData, setCoverageData] = useState<GeoCoveragePayload | null>(null);
  const [coverageLoading, setCoverageLoading] = useState(false);

  // Drill-down details for active selectedGeography
  const [countryProfile, setCountryProfile] = useState<GeoCountryProfile | null>(null);
  const [childBoundaryPayload, setChildBoundaryPayload] = useState<GeoBoundaryPayload | null>(null);
  const [childLoading, setChildLoading] = useState(false);
  const [childPlaces, setChildPlaces] = useState<GeoPlaceEntry[]>([]);
  const [childFilter, setChildFilter] = useState('');

  const selectedId = state.selectedObject?.regionId ?? state.selectedObject?.id ?? null;
  const selectedRegion = selectedId
    ? EARTH_REGIONS.find((r) => r.id === selectedId) ?? null
    : null;
  const selectedGeo = state.selectedGeography;
  const surfacePoint = !selectedRegion && !selectedGeo ? state.earthSurfacePoint : null;

  // Load world countries directory when browsing Geography Explorer
  useEffect(() => {
    if (state.earthExplorerFocus === 'geography' && allCountries.length === 0) {
      fetchCountriesLayer('110m').then(setAllCountries);
    }
  }, [state.earthExplorerFocus, allCountries.length]);

  // Load islands directory when browsing Island Explorer
  useEffect(() => {
    if (state.earthExplorerFocus === 'islands' && allIslands.length === 0) {
      setIslandsLoading(true);
      fetchIslandsLayer().then((list) => {
        setAllIslands(list);
        setIslandsLoading(false);
      });
    }
  }, [state.earthExplorerFocus, allIslands.length]);

  // Load Global Coverage stats whenever coverage tab opens or geography selection changes
  useEffect(() => {
    if (state.earthExplorerFocus === 'coverage') {
      setCoverageLoading(true);
      fetchGeoCoverage().then((cov) => {
        setCoverageData(cov);
        setCoverageLoading(false);
      });
    }
  }, [state.earthExplorerFocus, selectedGeo?.id]);

  // Load profile, child administrative divisions, & places when selectedGeo changes
  useEffect(() => {
    let cancelled = false;
    setChildFilter('');
    if (!selectedGeo) {
      setCountryProfile(null);
      setChildBoundaryPayload(null);
      setChildPlaces([]);
      setChildLoading(false);
      return;
    }

    if (selectedGeo.iso3) {
      fetchCountryProfile(selectedGeo.iso3).then((p) => {
        if (!cancelled) setCountryProfile(p);
      });
    } else {
      setCountryProfile(null);
    }

    if (selectedGeo.level === 'country' && selectedGeo.iso3) {
      setChildLoading(true);
      setChildPlaces([]);
      fetchAdminBoundaries(selectedGeo.iso3, 'ADM1').then((res) => {
        if (cancelled) return;
        setChildBoundaryPayload(res);
        setChildLoading(false);
      });
    } else if (selectedGeo.level === 'adm1' && selectedGeo.iso3) {
      setChildLoading(true);
      Promise.all([
        fetchAdminBoundaries(selectedGeo.iso3, 'ADM2', {
          parentName: selectedGeo.name,
          parentLevel: 'ADM1',
          parentBbox: selectedGeo.bbox,
        }),
        fetchPlaces({
          iso2: selectedGeo.iso2,
          stateCode: selectedGeo.stateCode,
          bbox: !selectedGeo.stateCode ? selectedGeo.bbox : undefined,
          limit: 60,
        }),
      ]).then(([adm2, places]) => {
        if (cancelled) return;
        setChildBoundaryPayload(adm2);
        setChildPlaces(places);
        setChildLoading(false);
      });
    } else if (selectedGeo.level === 'adm2' && selectedGeo.iso3) {
      setChildLoading(true);
      Promise.all([
        fetchAdminBoundaries(selectedGeo.iso3, 'ADM3', {
          parentName: selectedGeo.name,
          parentLevel: 'ADM2',
          parentBbox: selectedGeo.bbox,
        }),
        fetchPlaces({
          iso2: selectedGeo.iso2,
          bbox: selectedGeo.bbox,
          limit: 60,
        }),
      ]).then(([adm3, places]) => {
        if (cancelled) return;
        setChildBoundaryPayload(adm3);
        setChildPlaces(places);
        setChildLoading(false);
      });
    } else {
      setChildBoundaryPayload(null);
      setChildPlaces([]);
      setChildLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [selectedGeo?.id]);

  const filteredCountries = useMemo(() => {
    const q = countryFilterQuery.trim().toLowerCase();
    return allCountries
      .filter((c) => continentFilter === 'All' || (c.continent ?? '').toLowerCase() === continentFilter.toLowerCase())
      .filter(
        (c) =>
          !q ||
          c.name.toLowerCase().includes(q) ||
          (c.officialName ?? '').toLowerCase().includes(q) ||
          (c.iso3 ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allCountries, continentFilter, countryFilterQuery]);

  const filteredIslands = useMemo(() => {
    const q = islandFilterQuery.trim().toLowerCase();
    return allIslands
      .filter((i) => oceanFilter === 'All Oceans' || (i.ocean ?? '').toLowerCase().includes(oceanFilter.toLowerCase()))
      .filter(
        (i) =>
          !q ||
          i.name.toLowerCase().includes(q) ||
          (i.islandRegion ?? '').toLowerCase().includes(q) ||
          (i.countryOrTerritory ?? '').toLowerCase().includes(q)
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allIslands, oceanFilter, islandFilterQuery]);

  if (!state.infoPanelOpen) return null;

  const activeLat =
    selectedGeo?.lat ?? selectedRegion?.lat ?? surfacePoint?.lat ?? state.camera.targetLat;
  const activeLon =
    selectedGeo?.lon ?? selectedRegion?.lon ?? surfacePoint?.lon ?? state.camera.targetLon;

  const activeOverlay = EARTH_OVERLAYS[state.earthOverlay];
  const featuredRegions = EARTH_REGIONS.filter((r) => r.featured);
  const otherRegions = EARTH_REGIONS.filter((r) => !r.featured);

  const selectedLocationLabel =
    selectedGeo?.name ??
    selectedRegion?.name ??
    surfacePoint?.label ??
    'Global Orbital Overview';

  const subtitleLabel =
    selectedGeo?.officialName && selectedGeo.officialName !== selectedGeo.name
      ? selectedGeo.officialName
      : selectedGeo?.countryOrTerritory ??
        selectedRegion?.countryOrBasin ??
        surfacePoint?.countryOrBasin ??
        'Global Hydrosphere · Planetary View';

  const dataSourceLabel =
    selectedGeo?.datasetSource ??
    selectedRegion?.observationSource ??
    'Natural Earth · geoBoundaries · world-countries · USGS/UNESCO';
  const referenceDateLabel =
    selectedGeo?.datasetYear ??
    selectedRegion?.referenceEpoch ??
    'Open Geographical & Reference Datasets';

  const selectFeature = (f: GeoPolygonFeature, parentBreadcrumbs?: GeoBreadcrumbNode[]) => {
    const node = buildSelectedGeographyFromFeature(f, parentBreadcrumbs);
    const dist = computeRecommendedDistanceForBbox(f.bbox, 2.08);
    dispatchAction('select_geography', { geography: node, distance: dist }, 'mouse');
  };

  const selectPlace = (place: GeoPlaceEntry) => {
    if (!selectedGeo) return;
    const cityNode: GeoBreadcrumbNode = {
      id: place.id,
      name: place.name,
      level: 'city',
      levelLabel: 'City / Town',
      iso2: selectedGeo.iso2,
      iso3: selectedGeo.iso3,
      stateCode: place.stateCode,
      lat: place.lat,
      lon: place.lon,
    };
    const node: SelectedGeographyNode = {
      id: place.id,
      name: place.name,
      level: 'city',
      levelLabel: 'City / Town / Settlement',
      breadcrumbs: [...selectedGeo.breadcrumbs, cityNode],
      iso2: selectedGeo.iso2,
      iso3: selectedGeo.iso3,
      stateCode: place.stateCode,
      flag: selectedGeo.flag,
      continent: selectedGeo.continent,
      countryOrTerritory: selectedGeo.countryOrTerritory ?? selectedGeo.name,
      lat: place.lat,
      lon: place.lon,
      boundaryAvailable: false,
      datasetSource: place.datasetSource,
    };
    dispatchAction('select_geography', { geography: node, distance: 1.72 }, 'mouse');
  };

  const handleBreadcrumbClick = async (crumb: GeoBreadcrumbNode, idx: number) => {
    if (crumb.level === 'earth') {
      dispatchAction('clear_geography_selection', {}, 'mouse');
      dispatchAction('reset_earth_camera', {}, 'mouse');
      return;
    }
    if (crumb.level === 'continent' || crumb.level === 'ocean' || crumb.level === 'island-region') {
      dispatchAction('clear_geography_selection', {}, 'mouse');
      dispatchAction(
        'focus_earth_section',
        { focus: crumb.level === 'ocean' || crumb.level === 'island-region' ? 'islands' : 'geography' },
        'mouse'
      );
      if (crumb.level === 'continent') setContinentFilter(crumb.name);
      return;
    }
    if (crumb.level === 'country' && crumb.iso3) {
      const countries = await fetchCountriesLayer('50m');
      const matched = countries.find((c) => c.iso3 === crumb.iso3);
      if (matched) {
        selectFeature(matched);
        return;
      }
    }
    if ((crumb.level === 'adm1' || crumb.level === 'adm2') && crumb.iso3) {
      const adm = await fetchAdminBoundaries(
        crumb.iso3,
        crumb.level.toUpperCase() as 'ADM1' | 'ADM2'
      );
      const matched = adm.features.find(
        (f) => f.id === crumb.id || f.name.toLowerCase() === crumb.name.toLowerCase()
      );
      if (matched) {
        selectFeature(matched, selectedGeo?.breadcrumbs.slice(0, idx + 1));
        return;
      }
    }
    if (selectedGeo) {
      dispatchAction(
        'select_geography',
        {
          geography: {
            ...selectedGeo,
            id: crumb.id,
            name: crumb.name,
            level: crumb.level,
            levelLabel: crumb.levelLabel,
            lat: crumb.lat,
            lon: crumb.lon,
            bbox: crumb.bbox,
            breadcrumbs: selectedGeo.breadcrumbs.slice(0, idx + 1),
          },
          distance: computeRecommendedDistanceForBbox(crumb.bbox, 2.05),
        },
        'mouse'
      );
    }
  };

  const openRegionalSmartCity = (regionId: string) => {
    if (regionId === 'kerala') {
      dispatchAction('set_rainfall', { value: 92 }, 'mouse');
      dispatchAction('set_reservoir_storage', { value: 84 }, 'mouse');
    } else if (regionId === 'india' || regionId === 'ganga-brahmaputra') {
      dispatchAction('set_rainfall', { value: 58 }, 'mouse');
      dispatchAction('set_groundwater_extraction', { pct: 62 }, 'mouse');
    }
    dispatchAction('select_reservoir', { autoNavigate: true }, 'mouse');
  };

  const openRegionalUnderground = (regionId: string) => {
    if (regionId === 'kerala') {
      dispatchAction('set_rainfall', { value: 92 }, 'mouse');
      dispatchAction('select_well', { id: 'underground.well.01', autoNavigate: true }, 'mouse');
    } else {
      dispatchAction('select_aquifer', { id: 'underground.aquifer.02', autoNavigate: true }, 'mouse');
    }
  };

  return (
    <aside
      aria-label="Earth Information Inspector"
      className="aqua-scroll absolute top-3 right-3 bottom-24 z-10 w-[calc(100vw-1.5rem)] max-w-[374px] overflow-y-auto rounded-lg border border-cyan-500/25 bg-[#040a14]/94 p-4 shadow-2xl"
    >
      {/* Top Panel Title + Actions */}
      <div className="flex items-center justify-between gap-2 border-b border-cyan-500/20 pb-2.5">
        <div className="flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-cyan-400" />
          <span className="font-mono-tabular text-[11px] font-semibold uppercase tracking-[0.14em] text-cyan-300">
            {selectedGeo
              ? selectedGeo.levelLabel
              : state.earthExplorerFocus === 'islands'
                ? 'Island Explorer'
                : state.earthExplorerFocus === 'coverage'
                  ? 'Global Coverage'
                  : state.earthExplorerFocus === 'geography'
                    ? 'Geography Explorer'
                    : 'Earth Information'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {(selectedGeo || selectedRegion || surfacePoint) && (
            <button
              type="button"
              onClick={() => dispatchAction('reset_earth_camera', {}, 'mouse')}
              className="flex items-center gap-1 rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              <span>Global</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => dispatchAction('toggle_info_panel', { open: false }, 'mouse')}
            aria-label="Close Earth Information panel"
            className="rounded p-1 text-slate-400 hover:bg-white/5 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Interactive Geographical Hierarchy Breadcrumb */}
      {selectedGeo && selectedGeo.breadcrumbs.length > 0 && (
        <nav
          aria-label="Geographical Hierarchy Breadcrumb"
          className="mt-2.5 flex flex-wrap items-center gap-1 rounded-md border border-cyan-500/20 bg-[#060d1a] px-2.5 py-1.5"
        >
          {selectedGeo.breadcrumbs.map((crumb, idx) => {
            const isLast = idx === selectedGeo.breadcrumbs.length - 1;
            return (
              <React.Fragment key={`${crumb.id}-${idx}`}>
                {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-slate-500" />}
                <button
                  type="button"
                  disabled={isLast}
                  onClick={() => {
                    void handleBreadcrumbClick(crumb, idx);
                  }}
                  className={`rounded px-1 py-0.5 text-[10px] font-medium transition-colors ${
                    isLast
                      ? 'font-semibold text-cyan-200 cursor-default'
                      : 'text-slate-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {crumb.name.toUpperCase()}
                </button>
              </React.Fragment>
            );
          })}
        </nav>
      )}

      {/* Structured Location Telemetry Header */}
      <div className="mt-3 rounded-md border border-cyan-500/20 bg-[#060d1a] p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-slate-400">
              Selected Location
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 font-display text-base font-semibold text-white leading-tight">
              {selectedGeo?.flag && <span className="text-lg leading-none">{selectedGeo.flag}</span>}
              <span className="truncate">{selectedLocationLabel}</span>
            </div>
          </div>
          {selectedGeo && (
            <span
              className={`shrink-0 rounded border px-1.5 py-0.5 font-mono-tabular text-[9px] font-semibold uppercase ${
                selectedGeo.boundaryAvailable
                  ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                  : 'border-amber-400/40 bg-amber-500/15 text-amber-200'
              }`}
            >
              {selectedGeo.boundaryAvailable ? 'Mapped Polygon' : 'Boundary Unavailable'}
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-white/10 pt-2">
          <div>
            <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-slate-400">
              Latitude
            </div>
            <div className="font-mono-tabular text-xs font-semibold text-cyan-200">
              {formatCoord(activeLat, 'N', 'S')}
            </div>
          </div>
          <div>
            <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-slate-400">
              Longitude
            </div>
            <div className="font-mono-tabular text-xs font-semibold text-cyan-200">
              {formatCoord(activeLon, 'E', 'W')}
            </div>
          </div>
        </div>

        <div className="border-t border-white/10 pt-2">
          <div className="font-mono-tabular text-[10px] uppercase tracking-wider text-slate-400">
            {selectedGeo ? 'Official Designation / Parent' : 'Country / Basin'}
          </div>
          <div className="mt-0.5 text-xs font-medium text-slate-200">{subtitleLabel}</div>
        </div>
      </div>

      {/* MODE 1: Selected Geographical Country / Division / Island / City */}
      {selectedGeo ? (
        <div className="mt-4 space-y-4">
          {/* Verified Metadata Grid (honest Data Unavailable when missing) */}
          <div className="grid grid-cols-2 gap-2">
            {(selectedGeo.iso2 || selectedGeo.iso3) && (
              <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                <div className="text-[10px] text-slate-400">ISO Codes</div>
                <div className="font-mono-tabular text-xs font-semibold text-white">
                  {[selectedGeo.iso2, selectedGeo.iso3].filter(Boolean).join(' / ') || 'Data Unavailable'}
                </div>
              </div>
            )}

            {selectedGeo.level === 'country' && (
              <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                <div className="text-[10px] text-slate-400">Capital</div>
                <div className="truncate text-xs font-semibold text-white">
                  {selectedGeo.capital || countryProfile?.capital || 'Data Unavailable'}
                </div>
              </div>
            )}

            {selectedGeo.ocean && (
              <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                <div className="text-[10px] text-slate-400">Ocean / Sea</div>
                <div className="truncate text-xs font-semibold text-cyan-200">
                  {selectedGeo.ocean}
                </div>
              </div>
            )}

            <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
              <div className="text-[10px] text-slate-400">Area</div>
              <div className="font-mono-tabular text-xs font-semibold text-white">
                {selectedGeo.areaKm2
                  ? `${selectedGeo.areaKm2.toLocaleString()} km²`
                  : 'Data Unavailable'}
              </div>
            </div>

            <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
              <div className="text-[10px] text-slate-400">Population</div>
              <div className="font-mono-tabular text-xs font-semibold text-slate-300">
                {selectedGeo.population
                  ? selectedGeo.population.toLocaleString()
                  : 'Data Unavailable'}
              </div>
            </div>
          </div>

          {/* Child Administrative Divisions Drill-Down */}
          {(selectedGeo.level === 'country' ||
            selectedGeo.level === 'adm1' ||
            selectedGeo.level === 'adm2') && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="flex items-center justify-between">
                <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                  {selectedGeo.level === 'country'
                    ? childBoundaryPayload?.boundaryCanonical || 'States / Provinces (ADM1)'
                    : selectedGeo.level === 'adm1'
                      ? childBoundaryPayload?.boundaryCanonical || 'Districts / Counties (ADM2)'
                      : childBoundaryPayload?.boundaryCanonical || 'Local Divisions (ADM3)'}
                </div>
                {childLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
              </div>

              {!childLoading && childBoundaryPayload && childBoundaryPayload.available ? (
                <div className="space-y-2">
                  <div className="text-[10px] text-slate-400">
                    Showing {childBoundaryPayload.features.length} mapped {childBoundaryPayload.boundaryCanonical} boundaries ({childBoundaryPayload.boundaryYear})
                  </div>
                  {childBoundaryPayload.features.length > 8 && (
                    <input
                      type="text"
                      value={childFilter}
                      onChange={(e) => setChildFilter(e.target.value)}
                      placeholder={`Filter ${childBoundaryPayload.boundaryCanonical}...`}
                      className="h-7 w-full rounded border border-cyan-500/25 bg-[#060d1a] px-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
                    />
                  )}
                  <div className="aqua-scroll max-h-48 space-y-1 overflow-y-auto pr-1">
                    {childBoundaryPayload.features
                      .filter(
                        (f) =>
                          !childFilter.trim() ||
                          f.name.toLowerCase().includes(childFilter.trim().toLowerCase())
                      )
                      .sort((a, b) => a.name.localeCompare(b.name))
                      .map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            // Try matching ISO stateCode from countryProfile if drilling country -> ADM1
                            const matchedState =
                              f.level === 'adm1' && countryProfile
                                ? countryProfile.states.find(
                                    (s) =>
                                      s.name.toLowerCase() === f.name.toLowerCase() ||
                                      f.name.toLowerCase().includes(s.name.toLowerCase())
                                  )
                                : undefined;
                            selectFeature(
                              {
                                ...f,
                                stateCode: matchedState?.stateCode ?? f.stateCode,
                              },
                              selectedGeo.breadcrumbs
                            );
                          }}
                          className="flex w-full items-center justify-between rounded border border-cyan-500/20 bg-[#060d1a] px-2.5 py-1.5 text-left text-xs text-slate-100 hover:border-cyan-400/50 hover:bg-cyan-500/12 transition-colors"
                        >
                          <span className="truncate">{f.name}</span>
                          <span className="ml-2 shrink-0 font-mono-tabular text-[10px] text-cyan-300">
                            Zoom
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              ) : (
                !childLoading && (
                  <div className="space-y-2">
                    <div className="rounded border border-amber-400/30 bg-amber-500/10 p-2 text-[11px] text-amber-200">
                      Boundary Unavailable: {childBoundaryPayload?.reason ?? `No open ${selectedGeo.level === 'country' ? 'ADM1' : selectedGeo.level === 'adm1' ? 'ADM2' : 'ADM3'} polygon boundary dataset for ${selectedGeo.name}.`}
                    </div>
                    {/* Gazetteer fallback for ADM1 states when polygon boundaries aren't published */}
                    {selectedGeo.level === 'country' &&
                      countryProfile &&
                      countryProfile.states.length > 0 && (
                        <div className="aqua-scroll max-h-40 space-y-1 overflow-y-auto pr-1">
                          {countryProfile.states.map((st) => (
                            <button
                              key={st.stateCode}
                              type="button"
                              onClick={() => {
                                const node: SelectedGeographyNode = {
                                  id: `adm1-${countryProfile.iso3}-${st.stateCode}`,
                                  name: st.name,
                                  level: 'adm1',
                                  levelLabel: 'State / Province (Gazetteer)',
                                  breadcrumbs: [
                                    ...selectedGeo.breadcrumbs,
                                    {
                                      id: `adm1-${countryProfile.iso3}-${st.stateCode}`,
                                      name: st.name,
                                      level: 'adm1',
                                      levelLabel: 'State / Province',
                                      iso2: countryProfile.iso2,
                                      iso3: countryProfile.iso3,
                                      stateCode: st.stateCode,
                                      lat: st.lat,
                                      lon: st.lon,
                                    },
                                  ],
                                  iso2: countryProfile.iso2,
                                  iso3: countryProfile.iso3,
                                  stateCode: st.stateCode,
                                  flag: countryProfile.flag,
                                  continent: countryProfile.continent,
                                  countryOrTerritory: countryProfile.name,
                                  lat: st.lat,
                                  lon: st.lon,
                                  boundaryAvailable: false,
                                  datasetSource: 'country-state-city Gazetteer',
                                };
                                dispatchAction(
                                  'select_geography',
                                  { geography: node, distance: 1.92 },
                                  'mouse'
                                );
                              }}
                              className="flex w-full items-center justify-between rounded border border-white/10 bg-[#060d1a] px-2.5 py-1.5 text-left text-xs text-slate-200 hover:border-cyan-400/40"
                            >
                              <span className="truncate">{st.name}</span>
                              <span className="ml-2 shrink-0 font-mono-tabular text-[10px] text-slate-400">
                                {st.cityCount} places
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                  </div>
                )
              )}
            </div>
          )}

          {/* Cities / Towns / Settlements inside State or District */}
          {childPlaces.length > 0 && (
            <div className="space-y-2 border-t border-white/10 pt-3">
              <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                Cities, Towns &amp; Settlements ({childPlaces.length} shown)
              </div>
              <div className="aqua-scroll flex max-h-36 flex-wrap gap-1.5 overflow-y-auto pr-1">
                {childPlaces.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectPlace(p)}
                    className="rounded border border-white/12 bg-[#060d1a] px-2 py-1 text-[11px] text-slate-200 hover:border-emerald-400/45 hover:bg-emerald-500/12 transition-colors"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Island Action Shortcut */}
          {(selectedGeo.level === 'island' || selectedGeo.level === 'archipelago') && (
            <div className="rounded-md border border-teal-500/25 bg-[#060d1a] p-3 text-xs text-slate-300 space-y-2">
              <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-teal-300">
                Island &amp; Ocean Hierarchy
              </div>
              <p className="text-[11px] leading-relaxed">
                Located in <span className="text-white font-medium">{selectedGeo.ocean ?? 'Open Ocean'}</span>
                {selectedGeo.islandRegion ? ` (${selectedGeo.islandRegion})` : ''}. Real boundary coastline mapped from {selectedGeo.datasetSource}.
              </p>
              <button
                type="button"
                onClick={() => {
                  dispatchAction('clear_geography_selection', {}, 'mouse');
                  dispatchAction('focus_earth_section', { focus: 'islands' }, 'mouse');
                }}
                className="w-full rounded border border-teal-400/35 bg-teal-500/15 py-1.5 text-[11px] font-medium text-teal-100 hover:bg-teal-500/25 transition-colors"
              >
                Browse All Islands in {selectedGeo.ocean ?? 'Directory'}
              </button>
            </div>
          )}
        </div>
      ) : selectedRegion ? (
        /* MODE 2: Preserved Stage 1 Hydrologic Region Inspector */
        <div className="mt-4 space-y-4">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400">{selectedRegion.subtitle}</span>
            <span
              className={`rounded border px-2 py-0.5 font-mono-tabular text-[10px] font-semibold ${
                selectedRegion.waterStressLevel === 'High Stress'
                  ? 'border-amber-400/40 bg-amber-500/15 text-amber-200'
                  : selectedRegion.waterStressLevel === 'Seasonal Stress'
                    ? 'border-emerald-400/40 bg-emerald-500/15 text-emerald-200'
                    : 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
              }`}
            >
              {selectedRegion.waterStressLevel}
            </span>
          </div>

          <p className="text-xs leading-relaxed text-slate-200">{selectedRegion.summary}</p>

          <div className="space-y-2 border-y border-white/10 py-3">
            <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              Available Environmental Indicators
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              {selectedRegion.metrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2"
                >
                  <div className="text-[10px] text-slate-400">{metric.label}</div>
                  <div className="font-mono-tabular text-base font-semibold text-white">
                    {metric.value}
                  </div>
                  <div className="text-[10px] text-cyan-300/85">{metric.unit}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              <Info className="h-3.5 w-3.5" />
              <span>Earth Observation &amp; Hydrology</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {selectedRegion.scienceHighlight}
            </p>
          </div>

          <div className="space-y-2 rounded-md border border-cyan-500/25 bg-[#060d1a] p-3">
            <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              Launch Connected Simulation
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => openRegionalSmartCity(selectedRegion.id)}
                className="flex items-center justify-center gap-1.5 rounded border border-cyan-400/35 bg-cyan-500/15 px-2 py-1.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/25 transition-colors"
              >
                <Building2 className="h-3.5 w-3.5" />
                <span>Smart City</span>
              </button>
              <button
                type="button"
                onClick={() => openRegionalUnderground(selectedRegion.id)}
                className="flex items-center justify-center gap-1.5 rounded border border-emerald-400/35 bg-emerald-500/15 px-2 py-1.5 text-[11px] font-medium text-emerald-100 hover:bg-emerald-500/25 transition-colors"
              >
                <Layers className="h-3.5 w-3.5" />
                <span>Underground</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5 border-t border-white/10 pt-3">
            <div className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              <span>Conservation Strategy</span>
            </div>
            <p className="text-xs leading-relaxed text-slate-300">
              {selectedRegion.conservationNote}
            </p>
          </div>
        </div>
      ) : state.earthExplorerFocus === 'geography' ? (
        /* MODE 3: Global Countries & Territories Explorer */
        <div className="mt-4 space-y-3">
          <div className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
            <Compass className="h-3.5 w-3.5" />
            <span>Browse Countries &amp; Territories ({filteredCountries.length})</span>
          </div>

          <div className="flex flex-wrap gap-1">
            {CONTINENTS.map((cont) => (
              <button
                key={cont}
                type="button"
                onClick={() => setContinentFilter(cont)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  continentFilter === cont
                    ? 'border border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                    : 'border border-white/10 bg-[#060d1a] text-slate-400 hover:text-white'
                }`}
              >
                {cont}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={countryFilterQuery}
            onChange={(e) => setCountryFilterQuery(e.target.value)}
            placeholder="Filter countries, ISO codes, territories..."
            className="h-8 w-full rounded border border-cyan-500/25 bg-[#060d1a] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
          />

          <div className="aqua-scroll max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredCountries.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => selectFeature(c)}
                className="flex w-full items-center justify-between rounded border border-white/10 bg-[#060d1a] px-2.5 py-2 text-left hover:border-cyan-400/45 hover:bg-cyan-500/12 transition-colors"
              >
                <div className="min-w-0 flex items-center gap-2">
                  {c.flag && <span className="text-sm">{c.flag}</span>}
                  <div className="min-w-0">
                    <div className="truncate text-xs font-semibold text-white">{c.name}</div>
                    <div className="truncate font-mono-tabular text-[10px] text-slate-400">
                      {c.continent}
                      {c.iso3 ? ` · ${c.iso3}` : ''}
                      {c.isTerritory ? ' · Territory' : ''}
                    </div>
                  </div>
                </div>
                <span className="ml-2 shrink-0 font-mono-tabular text-[10px] text-cyan-300">
                  Explore
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : state.earthExplorerFocus === 'islands' ? (
        /* MODE 4: Island & Archipelago Explorer */
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-teal-300">
              <Anchor className="h-3.5 w-3.5" />
              <span>Islands &amp; Archipelagos ({filteredIslands.length})</span>
            </div>
            {islandsLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-teal-400" />}
          </div>

          <div className="flex flex-wrap gap-1">
            {OCEANS.map((oc) => (
              <button
                key={oc}
                type="button"
                onClick={() => setOceanFilter(oc)}
                className={`rounded px-2 py-0.5 text-[10px] font-medium transition-colors ${
                  oceanFilter === oc
                    ? 'border border-teal-400/45 bg-teal-500/20 text-teal-100'
                    : 'border border-white/10 bg-[#060d1a] text-slate-400 hover:text-white'
                }`}
              >
                {oc}
              </button>
            ))}
          </div>

          <input
            type="text"
            value={islandFilterQuery}
            onChange={(e) => setIslandFilterQuery(e.target.value)}
            placeholder="Filter islands, archipelagos, island nations..."
            className="h-8 w-full rounded border border-teal-500/25 bg-[#060d1a] px-2.5 text-xs text-slate-100 placeholder:text-slate-500 focus:border-teal-400/60 focus:outline-none"
          />

          <div className="aqua-scroll max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredIslands.slice(0, 120).map((isl) => (
              <button
                key={isl.id}
                type="button"
                onClick={() => selectFeature(isl)}
                className="flex w-full items-center justify-between rounded border border-white/10 bg-[#060d1a] px-2.5 py-2 text-left hover:border-teal-400/45 hover:bg-teal-500/12 transition-colors"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-white">
                    {isl.flag && <span>{isl.flag}</span>}
                    <span className="truncate">{isl.name}</span>
                  </div>
                  <div className="truncate font-mono-tabular text-[10px] text-slate-400">
                    {isl.levelLabel} · {isl.ocean}
                  </div>
                </div>
                <span className="ml-2 shrink-0 font-mono-tabular text-[10px] text-teal-300">
                  Fly
                </span>
              </button>
            ))}
          </div>
        </div>
      ) : state.earthExplorerFocus === 'coverage' ? (
        /* MODE 5: Honest Global Coverage Dashboard */
        <div className="mt-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
              <BarChart3 className="h-3.5 w-3.5" />
              <span>Real Loaded Dataset Coverage</span>
            </div>
            {coverageLoading && <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-400" />}
          </div>

          {coverageData ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">Countries &amp; Territories</div>
                  <div className="font-mono-tabular text-base font-semibold text-white">
                    {coverageData.totalCountriesAndTerritories}
                  </div>
                  <div className="text-[10px] text-cyan-300">
                    {coverageData.countriesCount} countries · {coverageData.territoriesCount} terr.
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">ADM1 Gazetteer</div>
                  <div className="font-mono-tabular text-base font-semibold text-white">
                    {coverageData.adm1GazetteerCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-cyan-300">
                    {coverageData.adm1BoundaryPolygonsLoaded} ADM1 polys cached
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">Cities &amp; Settlements</div>
                  <div className="font-mono-tabular text-base font-semibold text-white">
                    {coverageData.citiesIndexedCount.toLocaleString()}
                  </div>
                  <div className="text-[10px] text-emerald-300">Searchable globally</div>
                </div>
                <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">Islands &amp; Groups</div>
                  <div className="font-mono-tabular text-base font-semibold text-white">
                    {coverageData.islandsMappedCount + coverageData.archipelagosMappedCount}
                  </div>
                  <div className="text-[10px] text-teal-300">
                    {coverageData.islandsMappedCount > 0
                      ? `${coverageData.islandsMappedCount} isl · ${coverageData.archipelagosMappedCount} arch.`
                      : 'Open Island Explorer to load'}
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">ADM2 Cached Polys</div>
                  <div className="font-mono-tabular text-base font-semibold text-white">
                    {coverageData.adm2BoundaryPolygonsLoaded}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {coverageData.adm2BoundaryCountriesLoaded} countries loaded
                  </div>
                </div>
                <div className="rounded border border-white/10 bg-[#060d1a] px-2.5 py-2">
                  <div className="text-[10px] text-slate-400">ADM3 Cached Polys</div>
                  <div className="font-mono-tabular text-base font-semibold text-white">
                    {coverageData.adm3BoundaryPolygonsLoaded}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {coverageData.adm3BoundaryCountriesLoaded} countries loaded
                  </div>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                {coverageData.datasets.map((ds) => (
                  <div
                    key={ds.name}
                    className="rounded border border-white/10 bg-[#060d1a] p-2 text-[10px] space-y-0.5"
                  >
                    <div className="flex items-center justify-between gap-1">
                      <span className="font-semibold text-white truncate">{ds.name}</span>
                      <span className="shrink-0 rounded border border-cyan-500/30 bg-cyan-500/10 px-1.5 py-0.5 font-mono-tabular text-[9px] text-cyan-200">
                        {ds.status}
                      </span>
                    </div>
                    <div className="text-slate-300">{ds.coverageText}</div>
                    <div className="text-slate-500">License: {ds.license}</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded border border-white/10 bg-[#060d1a] p-3 text-xs text-slate-400">
              Loading verified dataset coverage counters...
            </div>
          )}
        </div>
      ) : (
        /* MODE 6: Preserved Overview & Water Intelligence Inspector */
        <div className="mt-4 space-y-4">
          <div className="space-y-1.5 rounded-md border border-white/10 bg-[#060d1a] p-3">
            <div className="flex items-center justify-between">
              <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                Earth Observation View
              </span>
              <span className="font-mono-tabular text-[10px] text-slate-400">
                {state.earthLayers.showOverlay ? activeOverlay.shortLabel : 'Natural Space View'}
              </span>
            </div>
            {surfacePoint ? (
              <p className="text-xs leading-relaxed text-slate-300">
                Open ocean or unmapped coordinate inspected directly on the 3D globe. Click any country border, island, or beacon to inspect administrative divisions and boundaries.
              </p>
            ) : state.earthLayers.showOverlay ? (
              <p className="text-xs leading-relaxed text-slate-300">{activeOverlay.description}</p>
            ) : (
              <p className="text-xs leading-relaxed text-slate-300">
                Click any country, state, district, or island boundary directly on the 3D globe, or use Global Search to fly to 250 countries, 4,963 first-level divisions, 148,038 cities, and mapped islands.
              </p>
            )}
          </div>

          <div className="space-y-2.5 border-t border-white/10 pt-3">
            <div className="flex items-baseline justify-between">
              <span className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                Planetary Water Indicators
              </span>
              <span className="font-mono-tabular text-xs text-cyan-200">
                {GLOBAL_WATER_BUDGET.totalVolumeKm3} km³
              </span>
            </div>

            <div className="space-y-1">
              <div className="flex h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div
                  className="bg-sky-600"
                  style={{ width: `${GLOBAL_WATER_BUDGET.saltwaterPercent}%` }}
                />
                <div
                  className="bg-cyan-300"
                  style={{ width: `${GLOBAL_WATER_BUDGET.freshwaterPercent}%` }}
                />
              </div>
              <div className="flex justify-between font-mono-tabular text-[10px] text-slate-300">
                <span>97.5% Saline Oceans</span>
                <span className="text-cyan-300 font-semibold">2.5% Freshwater</span>
              </div>
            </div>

            <div className="space-y-1 pt-0.5">
              {GLOBAL_WATER_BUDGET.freshwaterBreakdown.map((item) => (
                <div key={item.label} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-2 text-slate-300">
                    <span
                      className="h-2 w-2 rounded-xs shrink-0"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.label}</span>
                  </div>
                  <span className="font-mono-tabular text-slate-100">{item.percent}%</span>
                </div>
              ))}
            </div>

            {state.earthLayers.showOverlay && (
              <div className="space-y-1.5 border-t border-white/10 pt-2.5">
                <div className="font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-cyan-300">
                  Overlay Legend · {activeOverlay.shortLabel}
                </div>
                {activeOverlay.legend.map((entry) => (
                  <div key={entry.label} className="flex items-center gap-2 text-[11px] text-slate-300">
                    <span
                      className="h-2.5 w-2.5 rounded-xs shrink-0"
                      style={{ backgroundColor: entry.color }}
                    />
                    <span>{entry.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
              <MapPin className="h-3.5 w-3.5" />
              <span>Featured Focus Regions</span>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {featuredRegions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => focusRegion(region.id, 'mouse')}
                  className="flex items-center justify-between rounded-md border border-cyan-500/20 bg-[#060d1a] px-2.5 py-2 text-left hover:border-cyan-400/45 hover:bg-cyan-500/10 transition-colors"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-white">{region.name}</div>
                    <div className="truncate text-[10px] text-slate-400">{region.subtitle}</div>
                  </div>
                  <span className="ml-2 shrink-0 font-mono-tabular text-[10px] font-medium text-cyan-300">
                    Inspect
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 border-t border-white/10 pt-3">
            <div className="flex items-center gap-1.5 font-mono-tabular text-[10px] font-semibold uppercase tracking-wider text-slate-300">
              <Compass className="h-3.5 w-3.5 text-cyan-400" />
              <span>Global Basins &amp; Oceans</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {otherRegions.map((region) => (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => focusRegion(region.id, 'mouse')}
                  className="rounded border border-white/12 bg-[#060d1a] px-2 py-1 text-[11px] text-slate-200 hover:border-cyan-400/40 hover:bg-cyan-500/10 transition-colors whitespace-nowrap"
                >
                  {region.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Honest Data Source & Provenance Footer */}
      <div className="mt-4 rounded-md border border-white/10 bg-[#060d1a] p-2.5 text-[10px] leading-snug text-slate-400 space-y-1">
        <div className="flex items-center gap-1.5 font-mono-tabular font-semibold uppercase tracking-wider text-slate-300">
          <Database className="h-3 w-3 text-cyan-400" />
          <span>Dataset Provenance</span>
        </div>
        <div>
          <span className="text-slate-500">Source: </span>
          <span className="text-slate-300">{dataSourceLabel}</span>
        </div>
        <div>
          <span className="text-slate-500">Version / Epoch: </span>
          <span className="font-mono-tabular text-cyan-300/90">{referenceDateLabel}</span>
        </div>
        {selectedGeo?.datasetLicense && (
          <div>
            <span className="text-slate-500">License: </span>
            <span className="text-slate-300">{selectedGeo.datasetLicense}</span>
          </div>
        )}
      </div>
    </aside>
  );
};
