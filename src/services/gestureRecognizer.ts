import { GestureType } from '../types/exhibition';

export interface NormalizedLandmark {
  x: number;
  y: number;
  z: number;
}

export interface RecognitionConfig {
  sensitivity: number;
  pinchBaseline: number;
  neutralPalmOrigin: { x: number; y: number } | null;
  twoHandEnabled: boolean;
  paused: boolean;
  palmActive: boolean;
  activeScene: string;
}

export type GestureCommand =
  | { type: 'activate_palm'; origin: { x: number; y: number } }
  | { type: 'resume_gesture' }
  | { type: 'orbit_scene'; yawDelta: number; pitchDelta: number }
  | { type: 'zoom_scene'; delta: number; gesture: 'pinch' | 'two_hand_zoom' }
  | { type: 'point_select'; normX: number; normY: number }
  | { type: 'swipe_navigate'; direction: 'left' | 'right' }
  | { type: 'pause_simulation' };

export interface RecognitionOutput {
  handDetected: boolean;
  handCount: number;
  handedness: string | null;
  currentGesture: GestureType;
  gestureLabel: string;
  confidence: number;
  trackingLost: boolean;
  palmActive: boolean;
  pointer: {
    active: boolean;
    x: number;
    y: number;
    dwellProgress: number;
  };
  smoothedLandmarks: NormalizedLandmark[][];
  samplePinchRatio: number | null;
  samplePalmCenter: { x: number; y: number } | null;
  commands: GestureCommand[];
}

function dist2D(a: NormalizedLandmark, b: NormalizedLandmark): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export class GestureRecognizerEngine {
  private smoothedHands: NormalizedLandmark[][] = [];
  private palmActive = false;
  private palmOrigin: { x: number; y: number } | null = null;

  // Hold / duration timers
  private openPalmHoldStart = 0;
  private fistHoldStart = 0;
  private lastFistTrigger = 0;

  // Orbit & zoom throttling
  private lastOrbitEmit = 0;
  private lastZoomEmit = 0;
  private pinchMode: 'none' | 'in' | 'out' = 'none';
  private pinchCandidate: { mode: 'in' | 'out'; start: number } | null = null;
  private prevTwoHandDist: number | null = null;

  // Pointing dwell state
  private dwellAnchor: { x: number; y: number; start: number } | null = null;
  private lastPointTrigger = 0;

  // Swipe sliding history (mirrored X)
  private motionHistory: Array<{ x: number; y: number; t: number }> = [];
  private lastSwipeTrigger = 0;

  // Tracking loss debounce
  private lastHandSeenTime = 0;

  reset(): void {
    this.smoothedHands = [];
    this.palmActive = false;
    this.palmOrigin = null;
    this.openPalmHoldStart = 0;
    this.fistHoldStart = 0;
    this.pinchMode = 'none';
    this.pinchCandidate = null;
    this.prevTwoHandDist = null;
    this.dwellAnchor = null;
    this.motionHistory = [];
  }

  setCalibration(origin: { x: number; y: number } | null): void {
    this.palmOrigin = origin;
  }

  processFrame(
    rawHands: NormalizedLandmark[][],
    handednessList: Array<{ categoryName?: string; score?: number }[]>,
    nowMs: number,
    config: RecognitionConfig
  ): RecognitionOutput {
    const commands: GestureCommand[] = [];
    this.palmActive = config.palmActive;

    if (!rawHands || rawHands.length === 0) {
      const lost =
        this.lastHandSeenTime > 0 && nowMs - this.lastHandSeenTime > 450;
      this.openPalmHoldStart = 0;
      this.fistHoldStart = 0;
      this.pinchMode = 'none';
      this.prevTwoHandDist = null;
      this.dwellAnchor = null;
      if (lost) {
        this.smoothedHands = [];
        this.motionHistory = [];
      }
      return {
        handDetected: false,
        handCount: 0,
        handedness: null,
        currentGesture: 'none',
        gestureLabel: lost ? 'Tracking Lost — Show Hand' : 'Waiting for Hand',
        confidence: 0,
        trackingLost: lost,
        palmActive: this.palmActive,
        pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
        smoothedLandmarks: [],
        samplePinchRatio: null,
        samplePalmCenter: null,
        commands,
      };
    }

    // Confidence threshold check
    const primaryScore = handednessList?.[0]?.[0]?.score ?? 0.85;
    if (primaryScore < 0.55) {
      return {
        handDetected: false,
        handCount: rawHands.length,
        handedness: null,
        currentGesture: 'none',
        gestureLabel: 'Low Tracking Confidence',
        confidence: primaryScore,
        trackingLost: true,
        palmActive: this.palmActive,
        pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
        smoothedLandmarks: this.smoothedHands,
        samplePinchRatio: null,
        samplePalmCenter: null,
        commands,
      };
    }

    this.lastHandSeenTime = nowMs;

    // 1. Exponential Moving Average smoothing on landmarks
    const alpha = 0.42;
    this.smoothedHands = rawHands.map((hand, hIdx) => {
      const prev = this.smoothedHands[hIdx];
      if (!prev || prev.length !== hand.length) {
        return hand.map((p) => ({ ...p }));
      }
      return hand.map((p, i) => ({
        x: prev[i].x + (p.x - prev[i].x) * alpha,
        y: prev[i].y + (p.y - prev[i].y) * alpha,
        z: prev[i].z + (p.z - prev[i].z) * alpha,
      }));
    });

    const lm = this.smoothedHands[0];
    const handedness = handednessList?.[0]?.[0]?.categoryName ?? 'Hand';

    // Mirrored coordinates for natural exhibition screen orientation
    const palmCenter = {
      x: clamp(1 - (lm[0].x + lm[5].x + lm[9].x + lm[13].x + lm[17].x) / 5, 0.02, 0.98),
      y: clamp((lm[0].y + lm[5].y + lm[9].y + lm[13].y + lm[17].y) / 5, 0.02, 0.98),
    };

    const handScale = Math.max(0.06, dist2D(lm[0], lm[9]));
    const pinchRatio = dist2D(lm[4], lm[8]) / handScale;

    // Finger extension checks
    const indexExt = dist2D(lm[8], lm[0]) > dist2D(lm[6], lm[0]) * 1.08;
    const middleExt = dist2D(lm[12], lm[0]) > dist2D(lm[10], lm[0]) * 1.12;
    const ringExt = dist2D(lm[16], lm[0]) > dist2D(lm[14], lm[0]) * 1.12;
    const pinkyExt = dist2D(lm[20], lm[0]) > dist2D(lm[18], lm[0]) * 1.12;
    const thumbExt = dist2D(lm[4], lm[5]) > handScale * 0.42;

    const indexCurledTight = dist2D(lm[8], lm[0]) < dist2D(lm[6], lm[0]) * 1.02;
    const isOpenPalm = indexExt && middleExt && ringExt && pinkyExt && thumbExt;
    const isFist = indexCurledTight && !middleExt && !ringExt && !pinkyExt;
    const isPointing = indexExt && !middleExt && !ringExt && !pinkyExt;

    // Track motion history for swipe detection
    this.motionHistory.push({ x: palmCenter.x, y: palmCenter.y, t: nowMs });
    this.motionHistory = this.motionHistory.filter((pt) => nowMs - pt.t <= 380);

    // 2. If gesture input is paused, allow deliberate Open Palm (600ms) to resume
    if (config.paused) {
      if (isOpenPalm) {
        if (this.openPalmHoldStart === 0) this.openPalmHoldStart = nowMs;
        if (nowMs - this.openPalmHoldStart >= 600) {
          this.openPalmHoldStart = 0;
          this.palmActive = true;
          this.palmOrigin = palmCenter;
          commands.push({ type: 'resume_gesture' });
        }
      } else {
        this.openPalmHoldStart = 0;
      }
      return {
        handDetected: true,
        handCount: rawHands.length,
        handedness,
        currentGesture: isOpenPalm ? 'open_palm' : 'none',
        gestureLabel: isOpenPalm ? 'Hold Open Palm to Resume' : 'Gesture Input Paused',
        confidence: primaryScore,
        trackingLost: false,
        palmActive: false,
        pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
        smoothedLandmarks: this.smoothedHands,
        samplePinchRatio: pinchRatio,
        samplePalmCenter: palmCenter,
        commands,
      };
    }

    // 3. Optional Two-Hand Zoom (Gesture G)
    if (config.twoHandEnabled && this.smoothedHands.length >= 2) {
      const lm2 = this.smoothedHands[1];
      const p1 = { x: 1 - lm[9].x, y: lm[9].y };
      const p2 = { x: 1 - lm2[9].x, y: lm2[9].y };
      const twoDist = Math.hypot(p1.x - p2.x, p1.y - p2.y);

      if (this.prevTwoHandDist !== null && nowMs - this.lastZoomEmit > 140) {
        const diff = twoDist - this.prevTwoHandDist;
        if (Math.abs(diff) > 0.025) {
          // Spread apart (diff > 0) -> Zoom In (negative delta), together -> Zoom Out
          const step = clamp(
            -diff * 3.4 * config.sensitivity,
            -0.55,
            0.55
          );
          commands.push({
            type: 'zoom_scene',
            delta: Number(step.toFixed(2)),
            gesture: 'two_hand_zoom',
          });
          this.lastZoomEmit = nowMs;
          this.prevTwoHandDist = twoDist;
          return {
            handDetected: true,
            handCount: 2,
            handedness: 'Two Hands',
            currentGesture: 'two_hand_zoom',
            gestureLabel: diff > 0 ? 'Two-Hand Spread · Zoom In' : 'Two-Hand Closer · Zoom Out',
            confidence: primaryScore,
            trackingLost: false,
            palmActive: true,
            pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
            smoothedLandmarks: this.smoothedHands,
            samplePinchRatio: pinchRatio,
            samplePalmCenter: palmCenter,
            commands,
          };
        }
      }
      this.prevTwoHandDist = twoDist;
    } else {
      this.prevTwoHandDist = null;
    }

    // 4. Gesture A — Open Palm Activation (prevents accidental triggers on brief appearance)
    if (!this.palmActive) {
      if (isOpenPalm) {
        if (this.openPalmHoldStart === 0) this.openPalmHoldStart = nowMs;
        const heldMs = nowMs - this.openPalmHoldStart;
        if (heldMs >= 500) {
          this.palmActive = true;
          this.palmOrigin = config.neutralPalmOrigin ?? palmCenter;
          this.openPalmHoldStart = 0;
          commands.push({ type: 'activate_palm', origin: this.palmOrigin });
        }
        return {
          handDetected: true,
          handCount: rawHands.length,
          handedness,
          currentGesture: 'open_palm',
          gestureLabel:
            heldMs >= 500
              ? 'Open Palm Activated'
              : `Hold Open Palm (${Math.round((heldMs / 500) * 100)}%)`,
          confidence: primaryScore,
          trackingLost: false,
          palmActive: this.palmActive,
          pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
          smoothedLandmarks: this.smoothedHands,
          samplePinchRatio: pinchRatio,
          samplePalmCenter: palmCenter,
          commands,
        };
      }
      this.openPalmHoldStart = 0;
      return {
        handDetected: true,
        handCount: rawHands.length,
        handedness,
        currentGesture: 'none',
        gestureLabel: 'Show Open Palm to Activate',
        confidence: primaryScore,
        trackingLost: false,
        palmActive: false,
        pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
        smoothedLandmarks: this.smoothedHands,
        samplePinchRatio: pinchRatio,
        samplePalmCenter: palmCenter,
        commands,
      };
    }

    // 5. Gesture F — Deliberate Stable Fist -> Pause Simulation
    if (isFist) {
      this.dwellAnchor = null;
      this.pinchMode = 'none';
      if (this.fistHoldStart === 0) this.fistHoldStart = nowMs;
      const held = nowMs - this.fistHoldStart;
      let fired = false;
      if (held >= 540 && nowMs - this.lastFistTrigger > 1600) {
        this.lastFistTrigger = nowMs;
        this.fistHoldStart = 0;
        commands.push({ type: 'pause_simulation' });
        fired = true;
      }
      return {
        handDetected: true,
        handCount: rawHands.length,
        handedness,
        currentGesture: 'fist',
        gestureLabel: fired ? 'Fist · Simulation Paused' : 'Fist Hold · Pause Sim',
        confidence: primaryScore,
        trackingLost: false,
        palmActive: true,
        pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
        smoothedLandmarks: this.smoothedHands,
        samplePinchRatio: pinchRatio,
        samplePalmCenter: palmCenter,
        commands,
      };
    }
    this.fistHoldStart = 0;

    // 6. Gesture E — Rapid Horizontal Swipe (isolated from ordinary movement)
    if (
      (isOpenPalm || (indexExt && middleExt)) &&
      this.motionHistory.length >= 4 &&
      nowMs - this.lastSwipeTrigger > 1500
    ) {
      const oldest = this.motionHistory[0];
      const latest = this.motionHistory[this.motionHistory.length - 1];
      const dtSec = (latest.t - oldest.t) / 1000;
      const dx = latest.x - oldest.x;
      const dy = latest.y - oldest.y;
      if (
        dtSec >= 0.08 &&
        dtSec <= 0.38 &&
        Math.abs(dx) >= 0.23 &&
        Math.abs(dx) > Math.abs(dy) * 1.85 &&
        Math.abs(dx / dtSec) >= 0.68
      ) {
        const direction = dx > 0 ? 'right' : 'left';
        this.lastSwipeTrigger = nowMs;
        this.motionHistory = [];
        this.palmOrigin = palmCenter;
        commands.push({ type: 'swipe_navigate', direction });
        return {
          handDetected: true,
          handCount: rawHands.length,
          handedness,
          currentGesture: direction === 'right' ? 'swipe_right' : 'swipe_left',
          gestureLabel:
            direction === 'right' ? 'Swipe Right · Next Scene' : 'Swipe Left · Previous Scene',
          confidence: primaryScore,
          trackingLost: false,
          palmActive: true,
          pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
          smoothedLandmarks: this.smoothedHands,
          samplePinchRatio: pinchRatio,
          samplePalmCenter: palmCenter,
          commands,
        };
      }
    }

    // 7. Gesture C — Calibrated Pinch Zoom with Hysteresis (checked before Pointing)
    const baseline = config.pinchBaseline || 0.38;
    const enterZoomIn = Math.min(0.24, baseline * 0.58);
    const exitZoomIn = enterZoomIn + 0.05;
    const enterZoomOut = Math.max(0.58, baseline * 1.52);
    const exitZoomOut = enterZoomOut - 0.06;

    if (this.pinchMode === 'in' && pinchRatio > exitZoomIn) {
      this.pinchMode = 'none';
    } else if (this.pinchMode === 'out' && (pinchRatio < exitZoomOut || pinkyExt)) {
      this.pinchMode = 'none';
    }

    let rawPinchIntent: 'in' | 'out' | null = null;
    if (pinchRatio <= enterZoomIn && !(middleExt && ringExt && pinkyExt)) {
      rawPinchIntent = 'in';
    } else if (pinchRatio >= enterZoomOut && indexExt && thumbExt && !pinkyExt) {
      rawPinchIntent = 'out';
    }

    if (rawPinchIntent) {
      if (!this.pinchCandidate || this.pinchCandidate.mode !== rawPinchIntent) {
        this.pinchCandidate = { mode: rawPinchIntent, start: nowMs };
      } else if (nowMs - this.pinchCandidate.start >= 90) {
        this.pinchMode = rawPinchIntent;
      }
    } else {
      this.pinchCandidate = null;
    }

    if (this.pinchMode !== 'none') {
      this.dwellAnchor = null;
      if (nowMs - this.lastZoomEmit > 150) {
        const step = (this.pinchMode === 'in' ? -0.26 : 0.26) * config.sensitivity;
        commands.push({
          type: 'zoom_scene',
          delta: Number(clamp(step, -0.65, 0.65).toFixed(2)),
          gesture: 'pinch',
        });
        this.lastZoomEmit = nowMs;
      }
      return {
        handDetected: true,
        handCount: rawHands.length,
        handedness,
        currentGesture: 'pinch',
        gestureLabel:
          this.pinchMode === 'in' ? 'Pinch Closed · Zoom In' : 'Thumb-Index Spread · Zoom Out',
        confidence: primaryScore,
        trackingLost: false,
        palmActive: true,
        pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
        smoothedLandmarks: this.smoothedHands,
        samplePinchRatio: pinchRatio,
        samplePalmCenter: palmCenter,
        commands,
      };
    }

    // 8. Gesture D — Index Finger Pointing & Dwell Raycast Selection
    if (isPointing) {
      const tipX = clamp(1 - lm[8].x, 0.04, 0.96);
      const tipY = clamp(lm[8].y, 0.06, 0.94);

      if (
        !this.dwellAnchor ||
        Math.hypot(tipX - this.dwellAnchor.x, tipY - this.dwellAnchor.y) > 0.036
      ) {
        this.dwellAnchor = { x: tipX, y: tipY, start: nowMs };
      }

      const dwellMs = nowMs - this.dwellAnchor.start;
      const dwellProgress = clamp(dwellMs / 650, 0, 1);

      if (dwellMs >= 650 && nowMs - this.lastPointTrigger > 1150) {
        this.lastPointTrigger = nowMs;
        this.dwellAnchor = { x: tipX, y: tipY, start: nowMs };
        commands.push({ type: 'point_select', normX: tipX, normY: tipY });
      }

      return {
        handDetected: true,
        handCount: rawHands.length,
        handedness,
        currentGesture: 'pointing',
        gestureLabel:
          dwellProgress > 0.92 ? 'Pointing · Selecting Object' : 'Pointing · Aim at 3D Object',
        confidence: primaryScore,
        trackingLost: false,
        palmActive: true,
        pointer: {
          active: true,
          x: tipX,
          y: tipY,
          dwellProgress,
        },
        smoothedLandmarks: this.smoothedHands,
        samplePinchRatio: pinchRatio,
        samplePalmCenter: palmCenter,
        commands,
      };
    }
    this.dwellAnchor = null;

    // 9. Gesture B — Hand Movement (Smooth Scene Rotation / Orientation outside neutral deadzone)
    const origin = config.neutralPalmOrigin ?? this.palmOrigin ?? palmCenter;
    if (!this.palmOrigin) {
      this.palmOrigin = origin;
    }

    const offsetX = palmCenter.x - origin.x;
    const offsetY = palmCenter.y - origin.y;
    const radial = Math.hypot(offsetX, offsetY);
    const deadzone = 0.065;

    if (
      radial > deadzone &&
      isOpenPalm &&
      nowMs - this.lastOrbitEmit > 65 &&
      ['earth', 'city', 'underground', 'lab'].includes(config.activeScene)
    ) {
      const mag = (radial - deadzone) / (0.35 - deadzone);
      const gain = clamp(mag, 0, 1.3) * 0.085 * config.sensitivity;
      const yawDelta = Number(clamp((offsetX / radial) * gain * 1.4, -0.28, 0.28).toFixed(3));
      const pitchDelta = Number(clamp((offsetY / radial) * gain * 0.85, -0.2, 0.2).toFixed(3));
      if (Math.abs(yawDelta) > 0.005 || Math.abs(pitchDelta) > 0.005) {
        commands.push({ type: 'orbit_scene', yawDelta, pitchDelta });
        this.lastOrbitEmit = nowMs;
      }
      return {
        handDetected: true,
        handCount: rawHands.length,
        handedness,
        currentGesture: 'hand_move',
        gestureLabel:
          Math.abs(offsetX) >= Math.abs(offsetY)
            ? offsetX > 0
              ? 'Hand Right · Rotate Scene'
              : 'Hand Left · Rotate Scene'
            : offsetY < 0
              ? 'Hand Up · Tilt Camera'
              : 'Hand Down · Tilt Camera',
        confidence: primaryScore,
        trackingLost: false,
        palmActive: true,
        pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
        smoothedLandmarks: this.smoothedHands,
        samplePinchRatio: pinchRatio,
        samplePalmCenter: palmCenter,
        commands,
      };
    }

    return {
      handDetected: true,
      handCount: rawHands.length,
      handedness,
      currentGesture: isOpenPalm ? 'open_palm' : 'none',
      gestureLabel: isOpenPalm
        ? 'Open Palm Ready · Move, Pinch, Point or Swipe'
        : 'Hand Tracked (Neutral)',
      confidence: primaryScore,
      trackingLost: false,
      palmActive: true,
      pointer: { active: false, x: 0.5, y: 0.5, dwellProgress: 0 },
      smoothedLandmarks: this.smoothedHands,
      samplePinchRatio: pinchRatio,
      samplePalmCenter: palmCenter,
      commands,
    };
  }
}
