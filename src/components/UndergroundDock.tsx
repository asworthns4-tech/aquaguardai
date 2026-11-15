import React from 'react';
import {
  Building2,
  ChevronDown,
  ChevronUp,
  CloudRain,
  Globe,
  Pause,
  Play,
  RotateCcw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useAppState } from '../state/appStore';

const FOCUS_PRESETS = [
  { id: 'overview', label: 'Cutaway' },
  { id: 'water-table-plane', label: 'Water Table' },
  { id: 'layer-gravel', label: 'Unconfined' },
  { id: 'layer-confined-aquifer', label: 'Confined' },
  { id: 'borewell-central', label: 'Borewell' },
  { id: 'underground-reservoir', label: 'Vault' },
];

export const UndergroundDock: React.FC = () => {
  const { state, dispatchAction, focusUndergroundEntity } = useAppState();
  const { underground: ug, city } = state;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-11 sm:bottom-3 z-20 flex flex-col items-center px-3">
      <button
        type="button"
        onClick={() => dispatchAction('toggle_controls_collapsed', {}, 'mouse')}
        className="pointer-events-auto mb-1.5 flex items-center gap-1.5 rounded-full border border-cyan-500/25 bg-[#061121]/92 px-3 py-1 text-[11px] font-medium text-cyan-200 hover:bg-[#0b1d36] transition-colors whitespace-nowrap"
      >
        {state.controlsCollapsed ? (
          <>
            <ChevronUp className="h-3.5 w-3.5" />
            <span>Show Controls</span>
          </>
        ) : (
          <>
            <ChevronDown className="h-3.5 w-3.5" />
            <span>Hide Controls</span>
          </>
        )}
      </button>

      {!state.controlsCollapsed && (
        <div className="pointer-events-auto flex max-w-[min(1060px,96vw)] flex-wrap items-center justify-center gap-2 rounded-xl border border-cyan-500/25 bg-[#061121]/94 px-3 py-2.5 shadow-2xl">
          {/* Focus Presets */}
          <div className="flex items-center gap-1 rounded-lg bg-[#040a14] p-1 border border-white/5">
            {FOCUS_PRESETS.map((p) => {
              const active = ug.undergroundCameraPreset === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    if (p.id === 'overview') {
                      dispatchAction('reset_camera', {}, 'mouse');
                    } else {
                      focusUndergroundEntity(p.id, 'mouse');
                    }
                  }}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-cyan-500/20 text-cyan-200 border border-cyan-400/35'
                      : 'text-slate-300 hover:text-white hover:bg-white/5 border border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          <div className="hidden h-5 w-px bg-white/10 md:block" aria-hidden="true" />

          {/* Quick Hydrological Presets */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => {
                dispatchAction(
                  'set_underground_demo_phase',
                  { phase: ug.demoPhase === 'falling-table' ? 'recharge' : 'falling-table' },
                  'mouse'
                );
                dispatchAction('set_underground_tab', { tab: 'depletion' }, 'mouse');
              }}
              className="flex items-center gap-1.5 rounded-lg border border-amber-400/35 bg-amber-500/15 px-2.5 py-1.5 text-xs font-medium text-amber-200 hover:bg-amber-500/25 transition-colors whitespace-nowrap shrink-0"
            >
              <span>
                {ug.demoPhase === 'falling-table' ? 'Trigger Recharge' : 'Test Depletion'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = city.rainfallIntensity >= 85 ? 25 : 95;
                dispatchAction('set_rainfall', { value: next }, 'mouse');
              }}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <CloudRain className="h-3.5 w-3.5 text-cyan-300" />
              <span>{city.rainfallIntensity >= 85 ? 'Light Rain' : 'Heavy Rain'}</span>
            </button>
          </div>

          <div className="hidden h-5 w-px bg-white/10 md:block" aria-hidden="true" />

          {/* Camera & Cross-World Navigation */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => dispatchAction('rotate_scene', {}, 'mouse')}
              title={ug.undergroundAutoRotate ? 'Pause Orbit' : 'Auto-Orbit'}
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10 transition-colors"
            >
              {ug.undergroundAutoRotate ? (
                <Pause className="h-4 w-4 text-cyan-300" />
              ) : (
                <Play className="h-4 w-4 text-cyan-300" />
              )}
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('zoom_scene', { delta: 0.45 }, 'mouse')}
              title="Zoom Out"
              aria-label="Zoom Out"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10 transition-colors"
            >
              <ZoomOut className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('zoom_scene', { delta: -0.45 }, 'mouse')}
              title="Zoom In"
              aria-label="Zoom In"
              className="rounded-lg border border-white/10 bg-white/5 p-1.5 text-slate-200 hover:bg-white/10 transition-colors"
            >
              <ZoomIn className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('reset_camera', {}, 'mouse')}
              className="flex items-center gap-1 rounded-lg border border-cyan-400/25 bg-cyan-500/10 px-2.5 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors whitespace-nowrap shrink-0"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Reset</span>
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('navigate_to_city', {}, 'mouse')}
              className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <Building2 className="h-3.5 w-3.5 text-cyan-300" />
              <span>City</span>
            </button>

            <button
              type="button"
              onClick={() => dispatchAction('navigate_to_earth', {}, 'mouse')}
              className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1.5 text-xs font-medium text-slate-200 hover:bg-white/10 transition-colors whitespace-nowrap shrink-0"
            >
              <Globe className="h-3.5 w-3.5 text-cyan-300" />
              <span>Earth</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
