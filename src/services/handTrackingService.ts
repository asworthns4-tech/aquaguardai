import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision';
import { NormalizedLandmark } from './gestureRecognizer';

const HAND_LANDMARKER_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

const HAND_CONNECTIONS: Array<[number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
];

let cachedLandmarker: HandLandmarker | null = null;
let cachedNumHands = 1;

export async function getOrCreateHandLandmarker(numHands: 1 | 2): Promise<HandLandmarker> {
  if (cachedLandmarker && cachedNumHands === numHands) {
    return cachedLandmarker;
  }

  if (cachedLandmarker) {
    await cachedLandmarker.setOptions({ numHands });
    cachedNumHands = numHands;
    return cachedLandmarker;
  }

  const vision = await FilesetResolver.forVisionTasks('/mediapipe/wasm');

  try {
    cachedLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_LANDMARKER_MODEL_URL,
        delegate: 'GPU',
      },
      runningMode: 'VIDEO',
      numHands,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
  } catch {
    // Graceful CPU fallback when GPU WebGL delegate is unavailable
    cachedLandmarker = await HandLandmarker.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: HAND_LANDMARKER_MODEL_URL,
        delegate: 'CPU',
      },
      runningMode: 'VIDEO',
      numHands,
      minHandDetectionConfidence: 0.55,
      minHandPresenceConfidence: 0.55,
      minTrackingConfidence: 0.55,
    });
  }

  cachedNumHands = numHands;
  return cachedLandmarker;
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) return;
  stream.getTracks().forEach((track) => {
    try {
      track.stop();
    } catch {
      // Ignore already-stopped track errors
    }
  });
}

export function formatCameraError(err: unknown): string {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return 'Webcam access is not supported in this browser. Mouse, keyboard, and touch controls remain active.';
  }
  if (err instanceof DOMException) {
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      return 'Camera permission was denied. Allow webcam access in your browser settings or continue using mouse, keyboard, and touch.';
    }
    if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
      return 'No webcam detected on this device. Mouse, keyboard, and touch controls remain fully active.';
    }
    if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
      return 'Your webcam is currently busy in another app. Close the other camera app and try again.';
    }
  }
  const msg = err instanceof Error ? err.message : 'Unable to start webcam or MediaPipe model.';
  if (/fetch|network|Failed to fetch/i.test(msg)) {
    return 'MediaPipe Hand Landmarker model could not download (network restricted). Mouse, keyboard, and touch controls remain fully functional.';
  }
  return `${msg} Mouse, keyboard, and touch controls remain fully active.`;
}

export function drawHandSkeletonOverlay(
  canvas: HTMLCanvasElement,
  hands: NormalizedLandmark[][],
  mirrored = true,
  palmActive = false
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!hands || hands.length === 0) return;

  const w = canvas.width;
  const h = canvas.height;
  const lineColor = palmActive ? 'rgba(34, 211, 238, 0.85)' : 'rgba(148, 163, 184, 0.75)';
  const jointColor = palmActive ? '#34d399' : '#38bdf8';

  for (const lm of hands) {
    ctx.strokeStyle = lineColor;
    ctx.lineWidth = 2;
    for (const [startIdx, endIdx] of HAND_CONNECTIONS) {
      const a = lm[startIdx];
      const b = lm[endIdx];
      if (!a || !b) continue;
      const ax = (mirrored ? 1 - a.x : a.x) * w;
      const ay = a.y * h;
      const bx = (mirrored ? 1 - b.x : b.x) * w;
      const by = b.y * h;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();
    }

    for (let i = 0; i < lm.length; i++) {
      const pt = lm[i];
      const px = (mirrored ? 1 - pt.x : pt.x) * w;
      const py = pt.y * h;
      const isKeyTip = i === 4 || i === 8;
      ctx.fillStyle = isKeyTip ? '#22d3ee' : jointColor;
      ctx.beginPath();
      ctx.arc(px, py, isKeyTip ? 4.2 : 2.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
