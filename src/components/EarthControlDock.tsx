import React from 'react';
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Cloud,
  Globe,
  Grid3X3,
  Lightbulb,
  MapPinOff,
  Pause,
  Play,
  RotateCcw,
  Shapes,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { EARTH_OVERLAYS, EARTH_REGIONS } from '../data/earthWaterData';
import { useAppState } from '../state/appStore';
import { EarthOverlayMode } from '../types/exhibition';

const OVERLAY_ORDER: EarthOverlayMode[] = [
  'water-availability',
  'freshwater',
  'saltwater',
  'groundwater',
];

function fmtLatLon(lat: number, lon: number): string {
  const latStr = `${Math.abs(lat).toFixed(1)}°${lat >= 0 ? 'N' : 'S'}`;
  const lonStr = `${Math.abs(lon).toFixed(1)}°${lon >= 0 ? 'E' : 'W'}`;
  return `${latStr} · ${lonStr}`;
}

export const EarthControlDock: React.FC = () => {
  const { state, dispatchAction, focusRegion } = useAppState();

  const selectedId = state.selectedObject?.regionId ?? state.selectedObject?.id ?? null;
  const selectedRegion = selectedId
    ? EARTH_REGIONS.find((r) => r.id === selectedId) ?? null
    : null;
  const activeLat =
    state.selectedGeography?.lat ??
    selectedRegion?.lat ??
    state.earthSurfacePoint?.lat ??
    state.camera.targetLat;
  const activeLon =
    state.selectedGeography?.lon ??
    selectedRegion?.lon ??
    state.earthSurfacePoint?.lon ??
    state.camera.targetLon;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-11 sm:bottom-3 z-20 flex flex-col items-center px-3">
      {/* Compact Telemetry & Collapse Handle */}
      <div className="pointer-events-auto mb-1.5 flex items-center gap-2 rounded-md border border-cyan-500/25 bg-[#040a14]/94 px-2.5 py-1 text-[10px] shadow-lg">
        {state.selectedGeography && (
          <>
            <span className="max-w-[160px] truncate font-semibold text-white">
              {state.selectedGeography.flag ? `${state.selectedGeography.flag} ` : ''}
              {state.selectedGeography.name}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              |
            </span>
          </>
        )}
        <span className="font-mono-tabular text-cyan-300">
          {fmtLatLon(activeLat, activeLon)}
        </span>
        <span className="text-slate-600" aria-hidden="true">
          |
        </span>
        <span className="font-mono-tabular text-slate-300">
          Zoom {state.camera.zoomLevelPct}%
        </span>
        <span className="text-slate-600" aria-hidden="true">
          |
        </span>
        <button
          type="button"
          onClick={() => dispatchAction('toggle_controls_collapsed', {}, 'mouse')}
          className="flex items-center gap-1 font-medium text-cyan-200 hover:text-white transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-cyan-400"
        >
          {state.controlsCollapsed ? (
            <>
              <ChevronUp className="h-3 w-3" />
              <span>Controls</span>
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              <span>Hide</span>
            </>
          )}
        </button>
      </div>

      {/* Unified NASA Bottom Control Dock */}
      {!state.controlsCollapsed && (
        <div className="pointer-events-auto flex max-w-[min(1020px,96vw)] flex-wrap items-center justify-center gap-1.5 rounded-lg border border-cyan-500/25 bg-[#040a14]/94 px-2.5 py-2 shadow-2xl">
          {/* Group 1: Surface Mode */}
          <div className="flex flex-wrap items-center gap-1 rounded-md border border-white/10 bg-[#060d1a] p-1">
            <button
              type="button"
              onClick={() =>
                dispatchAction('toggle_earth_overlay_visibility', { visible: false }, 'mouse')
              }
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                !state.earthLayers.showOverlay
                  ? 'border border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              Natural
            </button>
            {OVERLAY_ORDER.map((id) => {
              const cfg = EARTH_OVERLAYS[id];
              const active = state.earthLayers.showOverlay && state.earthOverlay === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => dispatchAction('set_earth_overlay', { overlay: id }, 'mouse')}
                  className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'border border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                      : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {cfg.shortLabel}
                </button>
              );
            })}
          </div>

          {/* Group 2: Borders, Clouds, Lights, Grid */}
          <div className="flex items-center gap-1 rounded-md border border-white/10 bg-[#060d1a] p-1">
            <button
              type="button"
              onClick={() => dispatchAction('toggle_earth_boundaries', {}, 'mouse')}
              title="Toggle 3D Countries, Divisions & Island Boundaries"
              aria-pressed={state.earthLayers.showBoundaries}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                state.earthLayers.showBoundaries
                  ? 'border border-emerald-400/40 bg-emerald-500/18 text-emerald-100'
                  : 'border border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Shapes className="h-3 w-3" />
              <span className="hidden md:inline">Borders</span>
            </button>
            <button
              type="button"
              onClick={() => dispatchAction('toggle_earth_clouds', {}, 'mouse')}
              title="Toggle Cloud Layer"
              aria-pressed={state.earthLayers.showClouds}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                state.earthLayers.showClouds
                  ? 'border border-cyan-400/35 bg-cyan-500/15 text-cyan-100'
                  : 'border border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Cloud className="h-3 w-3" />
              <span className="hidden md:inline">Clouds</span>
            </button>
            <button
              type="button"
              onClick={() => dispatchAction('toggle_earth_night_lights', {}, 'mouse')}
              title="Toggle Night City Lights"
              aria-pressed={state.earthLayers.showNightLights}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                state.earthLayers.showNightLights
                  ? 'border border-amber-400/40 bg-amber-500/15 text-amber-200'
                  : 'border border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Lightbulb className="h-3 w-3" />
              <span className="hidden md:inline">Lights</span>
            </button>
            <button
              type="button"
              onClick={() => dispatchAction('toggle_earth_grid', {}, 'mouse')}
              title="Toggle 3D Lat/Lon Coordinate Grid"
              aria-pressed={state.earthLayers.showGrid}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                state.earthLayers.showGrid
                  ? 'border border-cyan-400/45 bg-cyan-500/20 text-cyan-100'
                  : 'border border-transparent text-slate-400 hover:text-white'
              }`}
            >
              <Grid3X3 className="h-3 w-3" />
              <span className="hidden md:inline">Grid</span>
            </button>
          </div>

          {/* Group 3: Quick Geographic Focus & Selection Nav */}
          <div className="hidden sm:flex items-center gap-1 rounded-md border border-white/10 bg-[#060d1a] p-1">
            <button
              type="button"
              onClick={() => dispatchAction('reset_earth_camera', {}, 'mouse')}
              className={`flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                state.camera.presetId === 'global' && !state.selectedGeography
                  ? 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-100'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              <Globe className="h-3 w-3" />
              <span>Global</span>
            </button>
            <button
              type="button"
              onClick={() => focusRegion('india', 'mouse')}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                state.camera.presetId === 'india'
                  ? 'border border-cyan-400/40 bg-cyan-500/20 text-cyan-100'
                  : 'border border-transparent text-slate-300 hover:bg-white/5 hover:text-white'
              }`}
            >
              India
            </button>
            <button
              type="button"
              onClick={() => focusRegion('kerala', 'mouse')}
              className={`rounded px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap ${
                state.camera.presetId === 'kerala'
                  ? 'border border-emerald-400/45 bg-emerald-500/20 text-emerald-200'
                  : 'border border-transparent text-emerald-300/90 hover:bg-emerald-500/10'
              }`}
            >
              Kerala
            </button>
            {state.selectedGeography && (
              <>
                <button
                  type="button"
                  onClick={() => dispatchAction('navigate_geography_parent', {}, 'mouse')}
                  title="Step Up One Hierarchy Level"
                  className="flex items-center gap-1 rounded border border-cyan-400/30 bg-cyan-500/12 px-2 py-1 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/22 transition-colors whitespace-nowrap"
                >
                  <ArrowUp className="h-3 w-3" />
                  <span>Parent</span>
                </button>
                <button
                  type="button"
                  onClick={() => dispatchAction('clear_geography_selection', {}, 'mouse')}
                  title="Clear Selected Boundary"
                  className="flex items-center gap-1 rounded border border-white/15 bg-white/5 px-1.5 py-1 text-[11px] text-slate-300 hover:text-white transition-colors"
                >
                  <MapPinOff className="h-3 w-3" />
                </button>
              </>
            )}
          </div>

          {/* Group 4: Orbit Rotation, Zoom & Reset */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatchAction('rotate_earth', {}, 'mouse')}
              title={state.camera.autoRotate ? 'Pause Earth Rotation' : 'Resume Earth Rotation'}
              aria-label={state.camera.autoRotate ? 'Pause Rotation' : 'Resume Rotation'}
              className="flex items-center gap-1 rounded-md border border-white/15 bg-[#060d1a] px-2.5 py-1.5 text-[11px] font-medium text-slate-200 hover:border-cyan-400/35 hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              {state.camera.autoRotate ? (
                <>
                  <Pause className="h-3.5 w-3.5 text-cyan-300" />
                  <span className="hidden md:inline">Pause</span>
                </>
              ) : (
                <>
                  <Play className="h-3.5 w-3.5 text-cyan-300" />
                  <span className="hidden md:inline">Rotate</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('zoom_earth', { delta: 0.42 }, 'mouse')}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="rounded-md border border-white/15 bg-[#060d1a] p-1.5 text-slate-200 hover:border-cyan-400/35 hover:text-white transition-colors"
            >
              <ZoomOut className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('zoom_earth', { delta: -0.42 }, 'mouse')}
              title="Zoom In"
              aria-label="Zoom In"
              className="rounded-md border border-white/15 bg-[#060d1a] p-1.5 text-slate-200 hover:border-cyan-400/35 hover:text-white transition-colors"
            >
              <ZoomIn className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('reset_earth_camera', {}, 'mouse')}
              title="Reset Camera View"
              className="flex items-center gap-1 rounded-md border border-cyan-400/35 bg-cyan-500/12 px-2.5 py-1.5 text-[11px] font-medium text-cyan-100 hover:bg-cyan-500/22 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Reset</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
