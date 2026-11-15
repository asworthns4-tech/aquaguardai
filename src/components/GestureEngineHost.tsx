import React, { useEffect, useRef } from 'react';
import { GestureRecognizerEngine, NormalizedLandmark } from '../services/gestureRecognizer';
import {
  formatCameraError,
  getOrCreateHandLandmarker,
  stopMediaStream,
} from '../services/handTrackingService';
import { useAppState } from '../state/appStore';

export interface GestureLiveFeed {
  stream: MediaStream | null;
  landmarksRef: React.MutableRefObject<NormalizedLandmark[][]>;
  lastSamplePinchRef: React.MutableRefObject<number | null>;
  lastSamplePalmRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

interface GestureEngineHostProps {
  onLiveFeedReady: (feed: GestureLiveFeed) => void;
}

export const GestureEngineHost: React.FC<GestureEngineHostProps> = ({ onLiveFeedReady }) => {
  const { state, dispatch, dispatchAction } = useAppState();
  const stateRef = useRef(state);
  stateRef.current = state;
  const dispatchActionRef = useRef(dispatchAction);
  dispatchActionRef.current = dispatchAction;
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  const streamRef = useRef<MediaStream | null>(null);
  const videoElRef = useRef<HTMLVideoElement | null>(null);
  const engineRef = useRef(new GestureRecognizerEngine());
  const landmarksRef = useRef<NormalizedLandmark[][]>([]);
  const lastSamplePinchRef = useRef<number | null>(null);
  const lastSamplePalmRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    onLiveFeedReady({
      stream: streamRef.current,
      landmarksRef,
      lastSamplePinchRef,
      lastSamplePalmRef,
    });
  }, [onLiveFeedReady]);

  // Keep engine calibration synchronized when reset/updated externally
  useEffect(() => {
    if (state.gesture.neutralPalmOrigin) {
      engineRef.current.setCalibration(state.gesture.neutralPalmOrigin);
    }
  }, [state.gesture.neutralPalmOrigin]);

  useEffect(() => {
    if (!state.gesture.enabled) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (videoElRef.current) {
        videoElRef.current.srcObject = null;
      }
      landmarksRef.current = [];
      engineRef.current.reset();
      onLiveFeedReady({
        stream: null,
        landmarksRef,
        lastSamplePinchRef,
        lastSamplePalmRef,
      });
      return;
    }

    let cancelled = false;
    let rafId = 0;
    let lastProcessAt = 0;
    let lastVideoTime = -1;
    let lastStatePushAt = 0;
    let lastGestureSent = '';
    let lastDetectedSent = false;
    let lastTrackingLostSent = false;

    const startTracking = async () => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        dispatchRef.current({
          type: 'UPDATE_GESTURE_STATE',
          patch: {
            enabled: false,
            cameraPermission: 'unavailable',
            cameraActive: false,
            modelStatus: 'error',
            errorMessage: formatCameraError(null),
          },
        });
        dispatchRef.current({
          type: 'SET_DEVICE_INTERFACE_STATUS',
          gestureStatus: 'unavailable',
        });
        return;
      }

      dispatchRef.current({
        type: 'UPDATE_GESTURE_STATE',
        patch: {
          cameraPermission: 'requesting',
          modelStatus: 'loading',
          errorMessage: null,
          gestureLabel: 'Requesting Camera Permission…',
        },
      });

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 640 },
            height: { ideal: 360 },
            facingMode: 'user',
          },
          audio: false,
        });

        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        streamRef.current = stream;
        onLiveFeedReady({
          stream,
          landmarksRef,
          lastSamplePinchRef,
          lastSamplePalmRef,
        });

        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        video.srcObject = stream;
        await video.play();
        videoElRef.current = video;

        dispatchRef.current({
          type: 'UPDATE_GESTURE_STATE',
          patch: {
            cameraPermission: 'granted',
            cameraActive: true,
            gestureLabel: 'Loading Hand Landmarker…',
          },
        });

        const numHands: 1 | 2 = stateRef.current.gesture.twoHandEnabled ? 2 : 1;
        const landmarker = await getOrCreateHandLandmarker(numHands);

        if (cancelled) {
          stopMediaStream(stream);
          return;
        }

        dispatchRef.current({
          type: 'UPDATE_GESTURE_STATE',
          patch: {
            modelStatus: 'ready',
            gestureLabel: 'Show Open Palm to Activate',
          },
        });

        const loop = (nowMs: number) => {
          if (cancelled || !videoElRef.current) return;
          rafId = requestAnimationFrame(loop);

          if (document.hidden) return;

          // Process frames at ~20 FPS so Three.js WebGL maintains full smoothness
          if (nowMs - lastProcessAt < 48) return;
          const vid = videoElRef.current;
          if (vid.readyState < 2 || vid.currentTime === lastVideoTime) return;

          lastProcessAt = nowMs;
          lastVideoTime = vid.currentTime;

          try {
            const result = landmarker.detectForVideo(vid, nowMs);
            const gState = stateRef.current.gesture;
            const out = engineRef.current.processFrame(
              (result.landmarks ?? []) as NormalizedLandmark[][],
              result.handedness ?? [],
              nowMs,
              {
                sensitivity: gState.sensitivity,
                pinchBaseline: gState.pinchBaseline,
                neutralPalmOrigin: gState.neutralPalmOrigin,
                twoHandEnabled: gState.twoHandEnabled,
                paused: gState.paused,
                palmActive: gState.palmActive,
                activeScene: stateRef.current.currentScene,
              }
            );

            landmarksRef.current = out.smoothedLandmarks;
            if (out.samplePinchRatio !== null) lastSamplePinchRef.current = out.samplePinchRatio;
            if (out.samplePalmCenter !== null) lastSamplePalmRef.current = out.samplePalmCenter;

            // Dispatch recognized stabilized commands through Phase 4 Action Registry
            for (const cmd of out.commands) {
              switch (cmd.type) {
                case 'activate_palm':
                  dispatchRef.current({
                    type: 'UPDATE_GESTURE_STATE',
                    patch: {
                      palmActive: true,
                      neutralPalmOrigin: cmd.origin,
                    },
                  });
                  break;
                case 'resume_gesture':
                  dispatchActionRef.current('resume_gesture_input', {}, 'gesture');
                  break;
                case 'orbit_scene':
                  dispatchActionRef.current(
                    'orbit_scene',
                    { yawDelta: cmd.yawDelta, pitchDelta: cmd.pitchDelta },
                    'gesture'
                  );
                  break;
                case 'zoom_scene':
                  dispatchActionRef.current('zoom_scene', { delta: cmd.delta }, 'gesture');
                  break;
                case 'point_select':
                  dispatchActionRef.current(
                    'point_select_at',
                    { normX: cmd.normX, normY: cmd.normY },
                    'gesture'
                  );
                  break;
                case 'swipe_navigate':
                  dispatchActionRef.current(
                    'swipe_navigate',
                    { direction: cmd.direction },
                    'gesture'
                  );
                  break;
                case 'pause_simulation':
                  dispatchActionRef.current('pause_simulation', {}, 'gesture');
                  break;
              }
            }

            // Update pointer reticle smoothly
            if (out.pointer.active || gState.pointerCursor.active) {
              dispatchRef.current({
                type: 'SET_GESTURE_POINTER',
                active: out.pointer.active,
                x: out.pointer.x,
                y: out.pointer.y,
                dwellProgress: out.pointer.dwellProgress,
                hoveredLabel: out.pointer.active ? undefined : null,
              });
            }

            // Throttle telemetry state sync to UI to prevent excess re-renders
            const meaningfulChange =
              out.currentGesture !== lastGestureSent ||
              out.handDetected !== lastDetectedSent ||
              out.trackingLost !== lastTrackingLostSent;

            if (meaningfulChange || nowMs - lastStatePushAt > 200) {
              lastGestureSent = out.currentGesture;
              lastDetectedSent = out.handDetected;
              lastTrackingLostSent = out.trackingLost;
              lastStatePushAt = nowMs;

              dispatchRef.current({
                type: 'UPDATE_GESTURE_STATE',
                patch: {
                  handDetected: out.handDetected,
                  handCount: out.handCount,
                  handedness: out.handedness,
                  palmActive: out.palmActive,
                  currentGesture: out.currentGesture,
                  gestureLabel: out.gestureLabel,
                  confidence: Number(out.confidence.toFixed(2)),
                  trackingLost: out.trackingLost,
                },
              });
            }
          } catch {
            // Skip single transient frame detection glitch gracefully
          }
        };

        rafId = requestAnimationFrame(loop);
      } catch (err) {
        if (cancelled) return;
        stopMediaStream(streamRef.current);
        streamRef.current = null;
        const permDenied =
          err instanceof DOMException &&
          (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError');
        const noCam =
          err instanceof DOMException &&
          (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError');

        dispatchRef.current({
          type: 'UPDATE_GESTURE_STATE',
          patch: {
            enabled: false,
            cameraPermission: permDenied ? 'denied' : noCam ? 'unavailable' : 'denied',
            cameraActive: false,
            modelStatus: 'error',
            errorMessage: formatCameraError(err),
            gestureLabel: 'Camera Unavailable',
          },
        });
        dispatchRef.current({
          type: 'SET_DEVICE_INTERFACE_STATUS',
          gestureStatus: noCam ? 'unavailable' : 'ready',
        });
      }
    };

    startTracking();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      stopMediaStream(streamRef.current);
      streamRef.current = null;
      if (videoElRef.current) {
        videoElRef.current.srcObject = null;
        videoElRef.current = null;
      }
      landmarksRef.current = [];
      engineRef.current.reset();
    };
  }, [state.gesture.enabled, state.gesture.twoHandEnabled, onLiveFeedReady]);

  return null;
};
