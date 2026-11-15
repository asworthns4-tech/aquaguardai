import React, { useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  Crosshair,
  Hand,
  HelpCircle,
  Pause,
  Play,
  ShieldCheck,
  Sliders,
  X,
} from 'lucide-react';
import { drawHandSkeletonOverlay } from '../services/handTrackingService';
import { useAppState } from '../state/appStore';
import { GestureLiveFeed } from './GestureEngineHost';

interface GestureControlPanelProps {
  liveFeed: GestureLiveFeed | null;
}

export const GestureControlPanel: React.FC<GestureControlPanelProps> = ({ liveFeed }) => {
  const { state, dispatchAction } = useAppState();
  const g = state.gesture;
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const skeletonCanvasRef = useRef<HTMLCanvasElement>(null);

  // Attach local MediaStream to mirrored preview element when panel opens
  useEffect(() => {
    const vid = previewVideoRef.current;
    if (!vid) return;
    if (g.panelOpen && g.cameraActive && liveFeed?.stream) {
      if (vid.srcObject !== liveFeed.stream) {
        vid.srcObject = liveFeed.stream;
        vid.play().catch(() => {});
      }
    } else {
      vid.srcObject = null;
    }
  }, [g.panelOpen, g.cameraActive, liveFeed]);

  // Render hand landmarks onto preview canvas overlay at ~20fps while panel is open
  useEffect(() => {
    if (!g.panelOpen || !g.cameraActive || !liveFeed) return;
    let raf = 0;
    let lastDraw = 0;
    const renderOverlay = (now: number) => {
      raf = requestAnimationFrame(renderOverlay);
      if (now - lastDraw < 48) return;
      lastDraw = now;
      if (skeletonCanvasRef.current) {
        drawHandSkeletonOverlay(
          skeletonCanvasRef.current,
          liveFeed.landmarksRef.current,
          true,
          state.gesture.palmActive
        );
      }
    };
    raf = requestAnimationFrame(renderOverlay);
    return () => cancelAnimationFrame(raf);
  }, [g.panelOpen, g.cameraActive, liveFeed, state.gesture.palmActive]);

  if (!g.panelOpen) return null;

  const handleCalibrate = () => {
    const samplePinch = liveFeed?.lastSamplePinchRef.current;
    const samplePalm = liveFeed?.lastSamplePalmRef.current;
    dispatchAction(
      'calibrate_gesture',
      {
        pinchBaseline: samplePinch ? Number(samplePinch.toFixed(3)) : 0.36,
        ...(samplePalm ? { originX: samplePalm.x, originY: samplePalm.y } : {}),
      },
      'mouse'
    );
  };

  return (
    <aside
      aria-label="Webcam Gesture Control Panel"
      className="aqua-scroll fixed top-16 left-4 bottom-24 z-30 flex w-[calc(100vw-2rem)] max-w-[356px] flex-col overflow-hidden rounded-xl border border-cyan-500/30 bg-[#061121]/97 shadow-2xl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <Hand className="h-4 w-4 text-cyan-300" />
          <div>
            <div className="text-[11px] font-medium text-cyan-300/90">
              MediaPipe Local Vision
            </div>
            <h2 className="font-display text-sm font-semibold text-white">
              Webcam Gesture Control
            </h2>
          </div>
        </div>
        <button
          type="button"
          onClick={() => dispatchAction('toggle_gesture_panel', { open: false }, 'mouse')}
          aria-label="Close Gesture Control Panel"
          className="rounded-md p-1 text-slate-400 hover:bg-white/5 hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="aqua-scroll flex-1 space-y-4 overflow-y-auto p-4 text-xs">
        {/* Camera Activation / Privacy Control */}
        <div className="rounded-lg border border-white/10 bg-[#040a14] p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-semibold text-slate-200 flex items-center gap-1.5">
              {g.cameraActive ? (
                <Camera className="h-3.5 w-3.5 text-emerald-300" />
              ) : (
                <CameraOff className="h-3.5 w-3.5 text-slate-400" />
              )}
              <span>Camera Stream</span>
            </span>
            <span
              className={`font-mono-tabular text-[11px] font-semibold ${
                g.cameraActive
                  ? 'text-emerald-300'
                  : g.cameraPermission === 'denied' || g.cameraPermission === 'unavailable'
                    ? 'text-amber-300'
                    : 'text-slate-400'
              }`}
            >
              {g.cameraActive
                ? 'Active (Local)'
                : g.cameraPermission === 'requesting'
                  ? 'Requesting…'
                  : g.cameraPermission === 'denied'
                    ? 'Permission Denied'
                    : g.cameraPermission === 'unavailable'
                      ? 'Unavailable'
                      : 'Off'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={g.enabled}
              onClick={() => dispatchAction('set_gesture_enabled', { enabled: true }, 'mouse')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                g.enabled
                  ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200 opacity-75 cursor-default'
                  : 'border-cyan-400/45 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30'
              }`}
            >
              <Camera className="h-3.5 w-3.5" />
              <span>Enable Gestures</span>
            </button>

            <button
              type="button"
              disabled={!g.enabled && !g.cameraActive}
              onClick={() => dispatchAction('set_gesture_enabled', { enabled: false }, 'mouse')}
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-3 text-xs font-semibold transition-colors whitespace-nowrap ${
                !g.enabled && !g.cameraActive
                  ? 'border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'
                  : 'border-rose-400/40 bg-rose-500/15 text-rose-200 hover:bg-rose-500/25'
              }`}
            >
              <CameraOff className="h-3.5 w-3.5" />
              <span>Camera Off</span>
            </button>
          </div>

          <p className="flex items-start gap-1.5 text-[11px] leading-snug text-slate-400">
            <ShieldCheck className="h-3.5 w-3.5 mt-0.5 shrink-0 text-emerald-300" />
            <span>
              Camera frames run strictly locally in your browser via MediaPipe. Video is never
              recorded, saved, or uploaded.
            </span>
          </p>
        </div>

        {/* Live Webcam Preview + Landmark Overlay */}
        <div className="overflow-hidden rounded-lg border border-white/10 bg-[#040a14]">
          <div className="relative aspect-video w-full bg-[#030710]">
            {g.cameraActive ? (
              <>
                <video
                  ref={previewVideoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover scale-x-[-1]"
                />
                <canvas
                  ref={skeletonCanvasRef}
                  width={320}
                  height={180}
                  className="pointer-events-none absolute inset-0 h-full w-full"
                />
                <div className="absolute top-2 left-2 flex items-center gap-1.5 rounded-md bg-[#040a14]/85 px-2 py-0.5 text-[10px] font-semibold text-emerald-200 border border-emerald-400/35">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  <span>LIVE LOCAL CAM</span>
                </div>
                {g.handedness && (
                  <div className="absolute top-2 right-2 rounded-md bg-[#040a14]/85 px-2 py-0.5 font-mono-tabular text-[10px] text-cyan-200 border border-cyan-400/30">
                    {g.handedness}
                  </div>
                )}
              </>
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-4 text-center">
                <CameraOff className="h-6 w-6 text-slate-500" />
                <div className="mt-1.5 text-xs font-medium text-slate-300">
                  Webcam Preview Inactive
                </div>
                <p className="mt-0.5 text-[11px] text-slate-400">
                  Press Enable Gestures above to grant camera access.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Error notice if webcam denied/unavailable or model failed offline */}
        {g.errorMessage && (
          <div className="rounded-lg border border-amber-400/40 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
            {g.errorMessage}
          </div>
        )}

        {/* Tracking Telemetry */}
        <div className="grid grid-cols-2 gap-2.5 rounded-lg border border-white/10 bg-[#040a14] p-3">
          <div>
            <div className="text-[11px] text-slate-400">Hand Detection</div>
            <div
              className={`mt-0.5 font-medium ${
                g.handDetected
                  ? 'text-emerald-300'
                  : g.trackingLost
                    ? 'text-amber-300'
                    : 'text-slate-300'
              }`}
            >
              {g.handDetected
                ? `Detected (${g.handCount})`
                : g.trackingLost
                  ? 'Tracking Lost'
                  : 'Waiting'}
            </div>
          </div>
          <div>
            <div className="text-[11px] text-slate-400">Confidence</div>
            <div className="mt-0.5 font-mono-tabular font-semibold text-white">
              {g.handDetected ? `${Math.round(g.confidence * 100)}%` : '—'}
            </div>
          </div>
          <div className="col-span-2 border-t border-white/10 pt-2">
            <div className="text-[11px] text-slate-400">Recognized Gesture</div>
            <div className="mt-0.5 font-medium text-cyan-200">{g.gestureLabel}</div>
          </div>
        </div>

        {/* Pause / Resume & Calibration Controls */}
        <div className="space-y-2.5 rounded-lg border border-white/10 bg-[#040a14] p-3">
          <div className="flex items-center justify-between text-slate-200 font-semibold">
            <span className="flex items-center gap-1.5">
              <Sliders className="h-3.5 w-3.5 text-cyan-300" />
              <span>Calibration &amp; Sensitivity</span>
            </span>
            <span className="font-mono-tabular text-cyan-300">{g.sensitivity.toFixed(1)}×</span>
          </div>

          <input
            type="range"
            min={0.5}
            max={2.0}
            step={0.1}
            value={g.sensitivity}
            aria-label="Gesture interaction sensitivity"
            onChange={(e) =>
              dispatchAction(
                'set_gesture_sensitivity',
                { sensitivity: Number(e.target.value) },
                'mouse'
              )
            }
            className="w-full accent-cyan-400"
          />

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              disabled={!g.enabled}
              onClick={() =>
                dispatchAction(
                  g.paused ? 'resume_gesture_input' : 'pause_gesture_input',
                  {},
                  'mouse'
                )
              }
              className={`flex items-center justify-center gap-1.5 rounded-lg border py-1.5 px-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                !g.enabled
                  ? 'border-white/10 bg-white/5 text-slate-500 cursor-not-allowed'
                  : g.paused
                    ? 'border-emerald-400/35 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25'
                    : 'border-amber-400/35 bg-amber-500/15 text-amber-200 hover:bg-amber-500/25'
              }`}
            >
              {g.paused ? (
                <>
                  <Play className="h-3.5 w-3.5" />
                  <span>Resume Input</span>
                </>
              ) : (
                <>
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause Input</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleCalibrate}
              className="flex items-center justify-center gap-1.5 rounded-lg border border-cyan-400/30 bg-cyan-500/10 py-1.5 px-2.5 text-xs font-medium text-cyan-200 hover:bg-cyan-500/20 transition-colors whitespace-nowrap"
            >
              <Crosshair className="h-3.5 w-3.5" />
              <span>Calibrate Hand</span>
            </button>
          </div>

          <label className="flex items-center justify-between gap-2 border-t border-white/10 pt-2.5 cursor-pointer">
            <span className="text-[11px] text-slate-300">
              Two-Hand Spread Zoom (Optional)
            </span>
            <input
              type="checkbox"
              checked={g.twoHandEnabled}
              onChange={(e) =>
                dispatchAction('set_gesture_two_hand', { enabled: e.target.checked }, 'mouse')
              }
              className="accent-cyan-400 h-4 w-4"
            />
          </label>
        </div>

        {/* Tutorial & Fallback Notice */}
        <button
          type="button"
          onClick={() => dispatchAction('toggle_gesture_tutorial', { open: true }, 'mouse')}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-cyan-400/35 bg-cyan-500/15 py-2 px-3 text-xs font-semibold text-cyan-100 hover:bg-cyan-500/25 transition-colors"
        >
          <HelpCircle className="h-4 w-4" />
          <span>Interactive Gesture Tutorial</span>
        </button>

        <p className="text-[11px] leading-snug text-slate-400">
          Mouse orbit, keyboard shortcuts, and touch remain fully active alongside gestures.
        </p>
      </div>
    </aside>
  );
};
