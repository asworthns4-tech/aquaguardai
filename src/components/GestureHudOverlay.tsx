import React from 'react';
import { AlertTriangle, CameraOff, Hand, Pause, Play } from 'lucide-react';
import { useAppState } from '../state/appStore';

export const GestureHudOverlay: React.FC = () => {
  const { state, dispatchAction } = useAppState();
  const g = state.gesture;

  // Pointing reticle (only when user is actively pointing in a 3D scene)
  const showReticle =
    g.enabled &&
    !g.paused &&
    g.pointerCursor.active &&
    ['earth', 'city', 'underground', 'lab'].includes(state.currentScene);

  const circumference = 2 * Math.PI * 16;
  const strokeOffset = circumference * (1 - g.pointerCursor.dwellProgress);

  return (
    <>
      {/* Subtle Top-Center Live Gesture HUD (non-obstructive) */}
      {(g.enabled || (g.errorMessage && !g.panelOpen)) && (
        <div
          aria-label="Live Gesture Status"
          className="pointer-events-auto fixed top-16 left-1/2 z-20 -translate-x-1/2 flex max-w-[min(680px,92vw)] items-center gap-2.5 rounded-lg border border-cyan-500/30 bg-[#061121]/95 px-3 py-1.5 text-xs shadow-xl"
        >
          {g.errorMessage && !g.enabled ? (
            <>
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-300" />
              <span className="truncate text-amber-200">{g.errorMessage}</span>
              <button
                type="button"
                onClick={() => dispatchAction('toggle_gesture_panel', { open: true }, 'mouse')}
                className="rounded border border-cyan-400/35 bg-cyan-500/15 px-2 py-0.5 text-[11px] font-medium text-cyan-200 hover:bg-cyan-500/25 whitespace-nowrap shrink-0"
              >
                Open Panel
              </button>
            </>
          ) : (
            <>
              <span className="flex items-center gap-1.5 whitespace-nowrap shrink-0">
                <span
                  className={`h-2 w-2 rounded-full ${
                    g.cameraActive
                      ? g.trackingLost
                        ? 'bg-amber-400'
                        : 'bg-emerald-400'
                      : 'bg-slate-400'
                  }`}
                />
                <Hand className="h-3.5 w-3.5 text-cyan-300" />
                <span className="font-semibold text-white">
                  {g.trackingLost ? 'Tracking Lost' : g.gestureLabel}
                </span>
              </span>

              {state.selectedObject && (
                <span className="hidden md:inline truncate text-[11px] text-cyan-300">
                  · Target: {state.selectedObject.name}
                </span>
              )}

              {state.interaction.currentAction && state.interaction.currentSource === 'gesture' && (
                <span className="hidden lg:inline font-mono-tabular text-[11px] text-emerald-300 whitespace-nowrap">
                  · {state.interaction.currentAction}
                </span>
              )}

              <div className="ml-1 flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() =>
                    dispatchAction(
                      g.paused ? 'resume_gesture_input' : 'pause_gesture_input',
                      {},
                      'mouse'
                    )
                  }
                  title={g.paused ? 'Resume Gesture Input' : 'Pause Gesture Input'}
                  className="flex items-center gap-1 rounded border border-white/15 bg-white/5 px-2 py-0.5 text-[11px] text-slate-200 hover:bg-white/10 whitespace-nowrap"
                >
                  {g.paused ? (
                    <>
                      <Play className="h-3 w-3 text-emerald-300" />
                      <span>Resume</span>
                    </>
                  ) : (
                    <>
                      <Pause className="h-3 w-3 text-amber-300" />
                      <span>Pause</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => dispatchAction('set_gesture_enabled', { enabled: false }, 'mouse')}
                  title="Turn Off Camera & Gesture Control"
                  className="flex items-center gap-1 rounded border border-rose-400/35 bg-rose-500/15 px-2 py-0.5 text-[11px] font-medium text-rose-200 hover:bg-rose-500/25 whitespace-nowrap"
                >
                  <CameraOff className="h-3 w-3" />
                  <span>Cam Off</span>
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Pointing Raycast Cursor Reticle */}
      {showReticle && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-30 -translate-x-1/2 -translate-y-1/2"
          style={{
            left: `${g.pointerCursor.x * 100}%`,
            top: `${g.pointerCursor.y * 100}%`,
          }}
        >
          <div className="relative flex items-center justify-center">
            <svg width="42" height="42" className="-rotate-90">
              <circle
                cx="21"
                cy="21"
                r="16"
                stroke="rgba(34, 211, 238, 0.35)"
                strokeWidth="2.5"
                fill="rgba(6, 17, 33, 0.35)"
              />
              <circle
                cx="21"
                cy="21"
                r="16"
                stroke="#22d3ee"
                strokeWidth="3"
                fill="none"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                strokeLinecap="round"
              />
            </svg>
            <span className="absolute h-2 w-2 rounded-full bg-cyan-300" />
          </div>

          {g.pointerCursor.hoveredLabel && (
            <div className="mt-1 -translate-x-1/2 left-1/2 relative whitespace-nowrap rounded-md border border-cyan-400/40 bg-[#061121]/95 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-100 shadow-lg">
              {g.pointerCursor.hoveredLabel} · Hold to select
            </div>
          )}
        </div>
      )}
    </>
  );
};
