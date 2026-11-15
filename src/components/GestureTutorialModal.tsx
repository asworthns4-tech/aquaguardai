import React, { useEffect, useState } from 'react';
import {
  ArrowLeftRight,
  Camera,
  CameraOff,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Crosshair,
  Hand,
  Minimize2,
  Move,
  PauseCircle,
  X,
} from 'lucide-react';
import { useAppState } from '../state/appStore';

interface TutorialStep {
  id: string;
  number: string;
  title: string;
  posture: string;
  actionDesc: string;
  icon: React.ReactNode;
  detectKey?: string;
}

const STEPS: TutorialStep[] = [
  {
    id: 'enable',
    number: '01',
    title: 'Enable Local Webcam',
    posture: 'Press Enable Gestures',
    actionDesc:
      'Your browser requests webcam permission only when you press Enable Gestures. Frames stay 100% on your device with zero uploads.',
    icon: <Camera className="h-5 w-5 text-cyan-300" />,
  },
  {
    id: 'open_palm',
    number: '02',
    title: 'Open Palm Activation',
    posture: 'Show an open palm for 0.5s',
    actionDesc:
      'Holding an open palm steadily unlocks gesture controls and calibrates your neutral hand center so accidental entrances never trigger moves.',
    icon: <Hand className="h-5 w-5 text-emerald-300" />,
    detectKey: 'open_palm',
  },
  {
    id: 'hand_move',
    number: '03',
    title: 'Move Hand to Rotate 3D Worlds',
    posture: 'Move open palm left, right, up, or down',
    actionDesc:
      'Shift your hand away from center to smoothly orbit the 3D Earth, Smart City, or Underground cutaway through the central camera registry.',
    icon: <Move className="h-5 w-5 text-cyan-300" />,
    detectKey: 'hand_move',
  },
  {
    id: 'pinch',
    number: '04',
    title: 'Pinch to Zoom In & Out',
    posture: 'Touch thumb & index together (in) or spread wide (out)',
    actionDesc:
      'Calibrated pinch distance with hysteresis smoothly zooms into continents, reservoirs, pipelines, and aquifers.',
    icon: <Minimize2 className="h-5 w-5 text-cyan-300" />,
    detectKey: 'pinch',
  },
  {
    id: 'pointing',
    number: '05',
    title: 'Point to Select 3D Objects',
    posture: 'Extend only your index finger and hold over target',
    actionDesc:
      'Aim the live cyan reticle over India, a Smart City reservoir, or an Underground aquifer and hold briefly to raycast-select it and open its info panel.',
    icon: <Crosshair className="h-5 w-5 text-cyan-300" />,
    detectKey: 'pointing',
  },
  {
    id: 'swipe',
    number: '06',
    title: 'Swipe Between Scenes',
    posture: 'Quick horizontal wave left or right',
    actionDesc:
      'A crisp lateral swipe switches directly between Earth Explorer, Future Smart City, and Underground Water World.',
    icon: <ArrowLeftRight className="h-5 w-5 text-cyan-300" />,
    detectKey: 'swipe',
  },
  {
    id: 'fist',
    number: '07',
    title: 'Fist to Pause Simulations',
    posture: 'Close hand into a steady fist for 0.5s',
    actionDesc:
      'Making a deliberate fist executes pause_simulation across the Smart City and Underground cutaway models simultaneously.',
    icon: <PauseCircle className="h-5 w-5 text-amber-300" />,
    detectKey: 'fist',
  },
  {
    id: 'disable',
    number: '08',
    title: 'Turn Camera Off Anytime',
    posture: 'Click Camera Off in the top bar or panel',
    actionDesc:
      'Stops all webcam tracks immediately while keeping mouse, keyboard, and touch controls active.',
    icon: <CameraOff className="h-5 w-5 text-rose-300" />,
  },
];

export const GestureTutorialModal: React.FC = () => {
  const { state, dispatchAction } = useAppState();
  const [stepIdx, setStepIdx] = useState(0);
  const [verifiedSteps, setVerifiedSteps] = useState<Record<string, boolean>>({});
  const g = state.gesture;

  // Live verification of practiced gestures when webcam is active
  useEffect(() => {
    if (!g.tutorialOpen) return;
    setVerifiedSteps((prev) => {
      const next = { ...prev };
      if (g.cameraActive) next.enable = true;
      if (g.palmActive || g.currentGesture === 'open_palm') next.open_palm = true;
      if (g.currentGesture === 'hand_move') next.hand_move = true;
      if (g.currentGesture === 'pinch' || g.currentGesture === 'two_hand_zoom') next.pinch = true;
      if (g.currentGesture === 'pointing') next.pointing = true;
      if (g.currentGesture === 'swipe_left' || g.currentGesture === 'swipe_right') {
        next.swipe = true;
      }
      if (g.currentGesture === 'fist') next.fist = true;
      return next;
    });
  }, [g.tutorialOpen, g.cameraActive, g.palmActive, g.currentGesture]);

  if (!g.tutorialOpen) return null;

  const step = STEPS[stepIdx];
  const isVerified = Boolean(verifiedSteps[step.id]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Interactive Gesture Tutorial"
      className="fixed inset-0 z-40 flex items-center justify-center bg-[#02060f]/80 p-4"
    >
      <div className="w-full max-w-xl rounded-xl border border-cyan-500/35 bg-[#061121] p-6 shadow-2xl">
        {/* Top Row */}
        <div className="flex items-start justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <div className="font-mono-tabular text-xs text-cyan-300">
              Interactive Gesture Guide · Step {step.number} of 08
            </div>
            <h2 className="mt-1 font-display text-xl font-semibold text-white">
              {step.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={() => dispatchAction('toggle_gesture_tutorial', { open: false }, 'mouse')}
            className="flex items-center gap-1 rounded-md border border-white/15 bg-white/5 px-2.5 py-1 text-xs font-medium text-slate-300 hover:bg-white/10 hover:text-white whitespace-nowrap"
          >
            <span>Skip Tutorial</span>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Step Progress Strip */}
        <div className="mt-4 grid grid-cols-8 gap-1.5">
          {STEPS.map((s, idx) => {
            const done = Boolean(verifiedSteps[s.id]);
            const active = idx === stepIdx;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStepIdx(idx)}
                title={s.title}
                className={`h-2 rounded-full transition-colors ${
                  done
                    ? 'bg-emerald-400'
                    : active
                      ? 'bg-cyan-400'
                      : 'bg-white/15 hover:bg-white/25'
                }`}
              />
            );
          })}
        </div>

        {/* Main Step Card */}
        <div className="mt-5 rounded-xl border border-white/10 bg-[#040a14] p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-cyan-500/30 bg-cyan-500/10">
                {step.icon}
              </div>
              <div>
                <div className="text-[11px] text-slate-400">How to Perform</div>
                <div className="text-sm font-semibold text-cyan-200">{step.posture}</div>
              </div>
            </div>

            {isVerified && (
              <span className="flex items-center gap-1 text-xs font-semibold text-emerald-300 whitespace-nowrap">
                <CheckCircle2 className="h-4 w-4" />
                <span>Detected Live</span>
              </span>
            )}
          </div>

          <p className="text-sm leading-relaxed text-slate-300">{step.actionDesc}</p>

          {/* Live Test Status inside Tutorial */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3 text-xs">
            <span className="text-slate-400">
              Live Status:{' '}
              <strong className="text-slate-200">
                {g.cameraActive ? g.gestureLabel : 'Camera Off'}
              </strong>
            </span>

            {!g.enabled ? (
              <button
                type="button"
                onClick={() => dispatchAction('set_gesture_enabled', { enabled: true }, 'mouse')}
                className="flex items-center gap-1.5 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-3 py-1.5 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 whitespace-nowrap"
              >
                <Camera className="h-3.5 w-3.5" />
                <span>Enable Camera to Practice</span>
              </button>
            ) : (
              step.id === 'disable' && (
                <button
                  type="button"
                  onClick={() => {
                    dispatchAction('set_gesture_enabled', { enabled: false }, 'mouse');
                    setVerifiedSteps((prev) => ({ ...prev, disable: true }));
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/25 whitespace-nowrap"
                >
                  <CameraOff className="h-3.5 w-3.5" />
                  <span>Test Safe Camera Off</span>
                </button>
              )
            )}
          </div>
        </div>

        {/* Navigation Footer */}
        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-white/10 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
          >
            <ChevronLeft className="h-4 w-4" />
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-2">
            {stepIdx < STEPS.length - 1 ? (
              <button
                type="button"
                onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
                className="flex items-center gap-1 rounded-lg border border-cyan-400/40 bg-cyan-500/20 px-4 py-2 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/30 whitespace-nowrap"
              >
                <span>Next Step</span>
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dispatchAction('toggle_gesture_tutorial', { open: false }, 'mouse')}
                className="rounded-lg border border-emerald-400/40 bg-emerald-500/20 px-4 py-2 text-xs font-semibold text-emerald-100 hover:bg-emerald-500/30 whitespace-nowrap"
              >
                Finish Tutorial
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
