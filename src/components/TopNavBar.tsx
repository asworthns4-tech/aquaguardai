import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AudioLines,
  Database,
  Droplets,
  Hand,
  Loader2,
  Menu,
  PanelLeftClose,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  Search,
  Terminal,
  X,
} from 'lucide-react';
import { EARTH_REGIONS, EXHIBITION_MODULES } from '../data/earthWaterData';
import { LAB_EXPERIMENTS } from '../data/labExperimentsData';
import {
  GeoSearchItem,
  buildSelectedGeographyFromFeature,
  computeRecommendedDistanceForBbox,
  fetchAdminBoundaries,
  fetchCountriesLayer,
  fetchCountryProfile,
  fetchIslandsLayer,
  searchGlobalGeography,
} from '../services/geoClient';
import { useAppState } from '../state/appStore';
import { GeoBreadcrumbNode, RegisteredActionName, SceneId, SelectedGeographyNode } from '../types/exhibition';

const SCENE_NAV_ACTION: Record<SceneId, RegisteredActionName> = {
  earth: 'navigate_to_earth',
  city: 'navigate_to_city',
  underground: 'navigate_to_underground',
  lab: 'navigate_to_lab',
  simulations: 'navigate_to_simulations',
  mission: 'navigate_to_mission',
  aqua: 'navigate_to_aqua',
  exhibition: 'navigate_to_earth',
};

interface SearchResultItem {
  id: string;
  kind: string;
  flag?: string;
  title: string;
  subtitle: string;
  onSelect: () => void;
}

export const TopNavBar: React.FC = () => {
  const { state, dispatchAction, focusRegion } = useAppState();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [geoResults, setGeoResults] = useState<GeoSearchItem[]>([]);
  const [geoLoading, setGeoLoading] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  // Debounced server global geography search across 250 countries, 4,963 ADM1s, 148,038 places & islands
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setGeoResults([]);
      setGeoLoading(false);
      return;
    }
    let cancelled = false;
    setGeoLoading(true);
    const timer = window.setTimeout(() => {
      searchGlobalGeography(q, 14)
        .then((items) => {
          if (!cancelled) {
            setGeoResults(items);
            setGeoLoading(false);
          }
        })
        .catch(() => {
          if (!cancelled) setGeoLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  const handleSelectGeoSearchItem = async (item: GeoSearchItem) => {
    setSearchQuery('');
    setSearchOpen(false);

    if (item.level === 'country' && item.iso3) {
      const [countries50, countries110] = await Promise.all([
        fetchCountriesLayer('50m'),
        fetchCountriesLayer('110m'),
      ]);
      const matched =
        countries50.find((c) => c.iso3 === item.iso3) ??
        countries110.find((c) => c.iso3 === item.iso3);
      if (matched) {
        const node = buildSelectedGeographyFromFeature(matched);
        dispatchAction(
          'select_geography',
          {
            geography: node,
            distance: computeRecommendedDistanceForBbox(matched.bbox, 2.25),
          },
          'mouse'
        );
        return;
      }
    }

    if ((item.level === 'island' || item.level === 'archipelago') && !item.id.startsWith('city-')) {
      const islands = await fetchIslandsLayer();
      const matched =
        islands.find((i) => i.id === item.id) ??
        islands.find((i) => i.name.toLowerCase() === item.name.toLowerCase());
      if (matched) {
        const node = buildSelectedGeographyFromFeature(matched);
        dispatchAction(
          'select_geography',
          {
            geography: node,
            distance: computeRecommendedDistanceForBbox(matched.bbox, 1.92),
          },
          'mouse'
        );
        return;
      }
    }

    if (item.level === 'adm1' && item.iso3) {
      const [profile, adm1] = await Promise.all([
        fetchCountryProfile(item.iso3),
        fetchAdminBoundaries(item.iso3, 'ADM1'),
      ]);
      const matched = adm1.available
        ? adm1.features.find(
            (f) =>
              f.name.toLowerCase() === item.name.toLowerCase() ||
              f.name.toLowerCase().includes(item.name.toLowerCase())
          )
        : undefined;

      if (matched) {
        const node = buildSelectedGeographyFromFeature(matched);
        dispatchAction(
          'select_geography',
          {
            geography: node,
            distance: computeRecommendedDistanceForBbox(matched.bbox, 1.92),
          },
          'mouse'
        );
        return;
      }

      const breadcrumbs: GeoBreadcrumbNode[] = [
        { id: 'earth-root', name: 'Earth', level: 'earth', levelLabel: 'Planet', lat: 16, lon: 76 },
      ];
      if (profile) {
        breadcrumbs.push({
          id: `continent-${profile.continent.toLowerCase()}`,
          name: profile.continent,
          level: 'continent',
          levelLabel: 'Continent',
          lat: profile.lat,
          lon: profile.lon,
        });
        breadcrumbs.push({
          id: `country-${profile.iso3}`,
          name: profile.name,
          level: 'country',
          levelLabel: profile.isTerritory ? 'Territory' : 'Country',
          iso2: profile.iso2,
          iso3: profile.iso3,
          lat: profile.lat,
          lon: profile.lon,
        });
      }
      breadcrumbs.push({
        id: item.id,
        name: item.name,
        level: 'adm1',
        levelLabel: adm1.boundaryCanonical || 'State / Province',
        iso2: item.iso2,
        iso3: item.iso3,
        stateCode: item.stateCode,
        lat: item.lat,
        lon: item.lon,
      });

      const node: SelectedGeographyNode = {
        id: item.id,
        name: item.name,
        level: 'adm1',
        levelLabel: adm1.boundaryCanonical || 'State / Province',
        breadcrumbs,
        iso2: item.iso2,
        iso3: item.iso3,
        stateCode: item.stateCode,
        flag: item.flag,
        continent: profile?.continent,
        countryOrTerritory: item.countryOrTerritory,
        lat: item.lat,
        lon: item.lon,
        boundaryAvailable: false,
        datasetSource: adm1.available
          ? `country-state-city (${adm1.boundarySource})`
          : 'country-state-city Gazetteer (Boundary Unavailable)',
      };
      dispatchAction('select_geography', { geography: node, distance: 1.9 }, 'mouse');
      return;
    }

    // Cities, Towns, or Cached ADM2/ADM3 divisions
    const profile = item.iso3 ? await fetchCountryProfile(item.iso3) : null;
    const breadcrumbs: GeoBreadcrumbNode[] = [
      { id: 'earth-root', name: 'Earth', level: 'earth', levelLabel: 'Planet', lat: 16, lon: 76 },
    ];
    if (profile) {
      breadcrumbs.push({
        id: `continent-${profile.continent.toLowerCase()}`,
        name: profile.continent,
        level: 'continent',
        levelLabel: 'Continent',
        lat: profile.lat,
        lon: profile.lon,
      });
      breadcrumbs.push({
        id: `country-${profile.iso3}`,
        name: profile.name,
        level: 'country',
        levelLabel: profile.isTerritory ? 'Territory' : 'Country',
        iso2: profile.iso2,
        iso3: profile.iso3,
        lat: profile.lat,
        lon: profile.lon,
      });
      if (item.stateCode) {
        const st = profile.states.find((s) => s.stateCode === item.stateCode);
        if (st) {
          breadcrumbs.push({
            id: `adm1-${profile.iso3}-${st.stateCode}`,
            name: st.name,
            level: 'adm1',
            levelLabel: 'State / Province',
            iso2: profile.iso2,
            iso3: profile.iso3,
            stateCode: st.stateCode,
            lat: st.lat,
            lon: st.lon,
          });
        }
      }
    }
    breadcrumbs.push({
      id: item.id,
      name: item.name,
      level: item.level,
      levelLabel: item.levelLabel,
      iso2: item.iso2,
      iso3: item.iso3,
      stateCode: item.stateCode,
      ocean: item.ocean,
      lat: item.lat,
      lon: item.lon,
    });

    const node: SelectedGeographyNode = {
      id: item.id,
      name: item.name,
      officialName: item.officialName,
      level: item.level,
      levelLabel: item.levelLabel,
      breadcrumbs,
      iso2: item.iso2,
      iso3: item.iso3,
      stateCode: item.stateCode,
      flag: item.flag,
      ocean: item.ocean,
      continent: profile?.continent,
      countryOrTerritory: item.countryOrTerritory,
      lat: item.lat,
      lon: item.lon,
      boundaryAvailable: item.boundaryAvailable,
      datasetSource: item.datasetSource,
    };
    dispatchAction(
      'select_geography',
      {
        geography: node,
        distance: item.level === 'city' ? 1.72 : 1.88,
      },
      'mouse'
    );
  };

  const localResults = useMemo<SearchResultItem[]>(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return [];

    const matches: SearchResultItem[] = [];

    for (const region of EARTH_REGIONS) {
      const hay = `${region.name} ${region.subtitle} ${region.category} ${region.countryOrBasin ?? ''}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `region-${region.id}`,
          kind: 'Water Region',
          title: region.name,
          subtitle: `${region.lat >= 0 ? `${region.lat.toFixed(1)}°N` : `${Math.abs(region.lat).toFixed(1)}°S`}, ${region.lon >= 0 ? `${region.lon.toFixed(1)}°E` : `${Math.abs(region.lon).toFixed(1)}°W`} · ${region.waterStressLevel}`,
          onSelect: () => {
            focusRegion(region.id, 'mouse');
            setSearchQuery('');
            setSearchOpen(false);
          },
        });
      }
    }

    // Strict Requirement #15: Exclude 'exhibition' (Presentation Mode) from search
    for (const mod of EXHIBITION_MODULES) {
      if (mod.id === 'exhibition') continue;
      const hay = `${mod.label} ${mod.shortLabel} ${mod.description}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `mod-${mod.id}`,
          kind: 'Module',
          title: mod.label,
          subtitle: `Module ${mod.number} · Phase ${mod.phase}`,
          onSelect: () => {
            dispatchAction(SCENE_NAV_ACTION[mod.id], {}, 'mouse');
            setSearchQuery('');
            setSearchOpen(false);
          },
        });
      }
    }

    for (const exp of LAB_EXPERIMENTS) {
      const hay = `${exp.title} ${exp.shortTitle} ${exp.subtitle} ${exp.category}`.toLowerCase();
      if (hay.includes(q)) {
        matches.push({
          id: `lab-${exp.id}`,
          kind: 'Science Lab',
          title: exp.title,
          subtitle: `Station ${exp.number} · ${exp.category}`,
          onSelect: () => {
            dispatchAction('navigate_to_lab', {}, 'mouse');
            dispatchAction('select_lab_experiment', { experimentId: exp.id, autoNavigate: true }, 'mouse');
            setSearchQuery('');
            setSearchOpen(false);
          },
        });
      }
    }

    return matches.slice(0, 5);
  }, [searchQuery, focusRegion, dispatchAction]);

  const combinedResults = useMemo<SearchResultItem[]>(() => {
    const mappedGeo: SearchResultItem[] = geoResults.map((g) => ({
      id: `geo-${g.id}`,
      kind: g.category,
      flag: g.flag,
      title: g.name,
      subtitle: g.hierarchyLabel,
      onSelect: () => {
        void handleSelectGeoSearchItem(g);
      },
    }));
    return [...mappedGeo, ...localResults].slice(0, 14);
  }, [geoResults, localResults]);

  const gestureActive = state.gesture.cameraActive;
  const handDetected = state.gesture.handDetected;
  const voiceStatusLabel =
    state.aqua.status === 'listening'
      ? 'Listening'
      : state.aqua.status === 'speaking'
        ? 'Speaking'
        : state.aqua.micSupported
          ? 'Ready'
          : 'Text Only';

  const gestureStatusLabel = gestureActive
    ? handDetected
      ? 'Tracking'
      : 'Cam On'
    : 'Ready';

  return (
    <header className="relative z-30 flex h-14 w-full items-center justify-between gap-3 border-b border-cyan-500/20 bg-[#02050b]/96 px-3 lg:px-5">
      {/* Left Cluster: Sidebar Toggle + NASA Brand Lockup */}
      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={() => dispatchAction('toggle_left_nav', {}, 'mouse')}
          title={state.leftNavOpen ? 'Hide Navigation Sidebar' : 'Show Navigation Sidebar'}
          aria-label={state.leftNavOpen ? 'Hide Navigation Sidebar' : 'Show Navigation Sidebar'}
          aria-expanded={state.leftNavOpen}
          className={`flex h-8 w-8 items-center justify-center rounded-md border transition-colors focus-visible:outline-2 focus-visible:outline-cyan-400 ${
            state.leftNavOpen
              ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-200'
              : 'border-white/15 bg-[#060d1a] text-slate-300 hover:border-cyan-400/35 hover:text-white'
          }`}
        >
          {state.leftNavOpen ? (
            <PanelLeftClose className="h-4 w-4" />
          ) : (
            <Menu className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          onClick={() => dispatchAction('focus_earth_section', { focus: 'overview' }, 'mouse')}
          className="flex items-center gap-2.5 text-left whitespace-nowrap shrink-0 rounded-md px-1 py-1 focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-cyan-400/35 bg-cyan-500/10 text-cyan-300">
            <Droplets className="h-4 w-4" />
          </span>
          <span className="flex flex-col leading-none">
            <span className="font-display text-sm font-bold tracking-[0.12em] text-white uppercase">
              AQUAGUARD AI
            </span>
            <span className="mt-0.5 font-mono-tabular text-[9px] font-medium tracking-[0.2em] text-cyan-300/85 uppercase">
              THE LIVING PLANET
            </span>
          </span>
        </button>
      </div>

      {/* Center Cluster: Global Geography & Module Search */}
      <div ref={searchWrapRef} className="relative flex-1 max-w-md min-w-[140px]">
        <div className="relative flex items-center">
          <Search
            className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-cyan-400/75"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setSearchOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setSearchOpen(false);
              } else if (e.key === 'Enter' && combinedResults.length > 0) {
                e.preventDefault();
                combinedResults[0].onSelect();
              }
            }}
            placeholder="Search countries, states, districts, cities, islands..."
            aria-label="Global Earth geography and module search"
            className="h-8 w-full rounded-md border border-cyan-500/25 bg-[#060d1a] pl-8 pr-7 text-xs text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/60 focus:outline-none"
          />
          {geoLoading ? (
            <Loader2 className="absolute right-2 h-3.5 w-3.5 animate-spin text-cyan-400" />
          ) : (
            searchQuery && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSearchOpen(false);
                }}
                aria-label="Clear search"
                className="absolute right-2 text-slate-400 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )
          )}
        </div>

        {searchOpen && searchQuery.trim() !== '' && (
          <div
            role="listbox"
            aria-label="Search results"
            className="aqua-scroll absolute top-10 right-0 left-0 z-40 max-h-80 overflow-y-auto rounded-lg border border-cyan-400/35 bg-[#040a14] p-1.5 shadow-2xl"
          >
            {combinedResults.length === 0 ? (
              <div className="px-3 py-2 text-xs text-slate-400">
                {geoLoading
                  ? 'Searching global geographical gazetteer...'
                  : `No countries, divisions, cities, islands, or modules matched “${searchQuery}”.`}
              </div>
            ) : (
              combinedResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onSelect}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left hover:bg-cyan-500/12 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 truncate text-xs font-semibold text-white">
                      {item.flag && <span className="shrink-0">{item.flag}</span>}
                      <span className="truncate">{item.title}</span>
                    </div>
                    <div className="truncate font-mono-tabular text-[10px] text-slate-400">
                      {item.subtitle}
                    </div>
                  </div>
                  <span className="shrink-0 rounded border border-cyan-500/25 bg-[#060d1a] px-1.5 py-0.5 font-mono-tabular text-[10px] text-cyan-300">
                    {item.kind}
                  </span>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Right Cluster: Telemetry & Device Control Status */}
      <div className="flex items-center gap-1.5 shrink-0">
        {(state.currentScene === 'city' ||
          state.currentScene === 'underground' ||
          state.currentScene === 'lab' ||
          state.currentScene === 'simulations') && (
          <button
            type="button"
            onClick={() =>
              dispatchAction(
                state.simulationParams.running ? 'pause_simulation' : 'resume_simulation',
                {},
                'mouse'
              )
            }
            title={
              state.simulationParams.running
                ? 'Pause Live Simulation (P)'
                : 'Resume Live Simulation (P)'
            }
            className={`hidden md:flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              state.simulationParams.running
                ? 'border-emerald-400/35 bg-emerald-500/12 text-emerald-200 hover:bg-emerald-500/20'
                : 'border-amber-400/40 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
            }`}
          >
            {state.simulationParams.running ? (
              <>
                <Pause className="h-3 w-3" />
                <span className="font-mono-tabular">{state.simulationParams.speed}×</span>
              </>
            ) : (
              <>
                <Play className="h-3 w-3" />
                <span>Paused</span>
              </>
            )}
          </button>
        )}

        <div
          title="Global boundaries use Natural Earth, world-countries, country-state-city, and geoBoundaries open datasets; hydrological models are deterministic educational simulations."
          className="hidden xl:flex items-center gap-1.5 rounded-md border border-cyan-500/20 bg-[#060d1a] px-2.5 py-1 text-[11px] text-slate-300 whitespace-nowrap"
        >
          <Database className="h-3 w-3 text-cyan-400" />
          <span className="font-mono-tabular">Open Geo + Reference</span>
        </div>

        <button
          type="button"
          onClick={() => dispatchAction('toggle_aqua_panel', {}, 'mouse')}
          title="AQUA AI Voice & Command Panel (A)"
          aria-label="Toggle AQUA AI Assistant"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400 ${
            state.aqua.status === 'listening' || state.aqua.status === 'speaking'
              ? 'border-emerald-400/45 bg-emerald-500/18 text-emerald-100'
              : state.aqua.panelOpen
                ? 'border-cyan-400/45 bg-cyan-500/18 text-cyan-100'
                : 'border-white/15 bg-[#060d1a] text-slate-200 hover:border-cyan-400/35 hover:text-white'
          }`}
        >
          <AudioLines className="h-3.5 w-3.5 text-cyan-300" />
          <span className="hidden sm:inline font-mono-tabular">Voice: {voiceStatusLabel}</span>
        </button>

        <button
          type="button"
          onClick={() => dispatchAction('toggle_gesture_panel', {}, 'mouse')}
          title="Webcam Hand Gesture Controls (G)"
          aria-label="Toggle Gesture Control Panel"
          className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
            gestureActive
              ? 'border-emerald-400/45 bg-emerald-500/18 text-emerald-100 hover:bg-emerald-500/25'
              : state.gesture.panelOpen
                ? 'border-cyan-400/45 bg-cyan-500/18 text-cyan-100'
                : 'border-white/15 bg-[#060d1a] text-slate-200 hover:border-cyan-400/35 hover:text-white'
          }`}
        >
          <Hand className="h-3.5 w-3.5 text-cyan-300" />
          <span className="hidden sm:inline font-mono-tabular">
            Gestures: {gestureStatusLabel}
          </span>
        </button>

        {!state.exhibitionMode && (
          <button
            type="button"
            onClick={() => dispatchAction('toggle_debug_panel', {}, 'debug')}
            title="Developer Interaction Debug Panel (Shift+D)"
            aria-label="Toggle Interaction Debug Panel"
            className={`hidden 2xl:flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
              state.debugPanelOpen
                ? 'border-cyan-400/45 bg-cyan-500/18 text-cyan-100'
                : 'border-white/15 bg-[#060d1a] text-slate-300 hover:text-white'
            }`}
          >
            <Terminal className="h-3.5 w-3.5" />
            <span>Log</span>
          </button>
        )}

        {state.currentScene === 'earth' ||
        state.currentScene === 'city' ||
        state.currentScene === 'underground' ||
        state.currentScene === 'lab' ? (
          <button
            type="button"
            onClick={() => dispatchAction('toggle_info_panel', {}, 'mouse')}
            aria-label={state.infoPanelOpen ? 'Hide Information Panel' : 'Open Information Panel'}
            className="flex items-center gap-1.5 rounded-md border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/22 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            {state.infoPanelOpen ? (
              <>
                <PanelRightClose className="h-3.5 w-3.5" />
                <span className="hidden md:inline">Hide Info</span>
              </>
            ) : (
              <>
                <PanelRightOpen className="h-3.5 w-3.5" />
                <span className="hidden md:inline">
                  {state.currentScene === 'earth'
                    ? 'Earth Info'
                    : state.currentScene === 'city'
                      ? 'City Info'
                      : state.currentScene === 'underground'
                        ? 'Aquifer Info'
                        : 'Lab Info'}
                </span>
              </>
            )}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => dispatchAction('focus_earth_section', { focus: 'overview' }, 'mouse')}
            className="rounded-md border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-1 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/22 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-2 focus-visible:outline-cyan-400"
          >
            Earth View
          </button>
        )}
      </div>
    </header>
  );
};
