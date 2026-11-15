import { useCallback, useEffect, useRef } from 'react';
import { runAquaTurn } from '../services/aquaBrain';
import {
  getSpeechCapabilities,
  speakAquaText,
  stopAquaSpeaking,
} from '../services/aquaSpeech';
import { AquaSpeechRecognitionService } from '../services/speechService';
import { useAppState } from '../state/appStore';
import { AquaLanguage } from '../types/exhibition';

export function useAquaStatusSync() {
  const { state, dispatch } = useAppState();
  const checkedRef = useRef(false);

  // Sync server AI brain availability once without exposing secrets
  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    let cancelled = false;
    fetch('/api/aqua/status')
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { liveAiAvailable?: boolean; mode?: 'live' | 'offline-demo'; reason?: string } | null) => {
        if (cancelled || !data) return;
        dispatch({
          type: 'UPDATE_AQUA_STATE',
          patch: {
            aiMode: data.liveAiAvailable ? 'live' : 'offline-demo',
            aiReason: data.liveAiAvailable
              ? null
              : 'No server Gemini API key configured — using local Offline Demo Mode.',
          },
        });
      })
      .catch(() => {
        if (cancelled) return;
        dispatch({
          type: 'UPDATE_AQUA_STATE',
          patch: {
            aiMode: 'offline-demo',
            aiReason: 'AI endpoint unreachable — running local Offline Demo Mode.',
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Keep TTS voice support flag synchronized for the currently selected language
  useEffect(() => {
    const updateVoices = () => {
      const caps = getSpeechCapabilities();
      dispatch({
        type: 'UPDATE_AQUA_STATE',
        patch: {
          micSupported: caps.recognitionSupported,
          ttsSupported: caps.synthesisSupported,
          ttsLanguageSupported: caps.ttsVoicesAvailableForLang[state.aqua.language],
        },
      });
    };
    updateVoices();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.addEventListener?.('voiceschanged', updateVoices);
      return () => {
        window.speechSynthesis.removeEventListener?.('voiceschanged', updateVoices);
      };
    }
    return undefined;
  }, [dispatch, state.aqua.language]);
}

export function useAquaController() {
  const { state, dispatch, dispatchAction } = useAppState();
  const stateRef = useRef(state);
  stateRef.current = state;

  const speechServiceRef = useRef<AquaSpeechRecognitionService | null>(null);
  if (!speechServiceRef.current) {
    speechServiceRef.current = new AquaSpeechRecognitionService(state.aqua.language);
  }

  useEffect(() => {
    speechServiceRef.current?.setLanguage(state.aqua.language);
  }, [state.aqua.language]);

  useEffect(() => {
    const svc = speechServiceRef.current;
    return () => {
      svc?.abort();
      stopAquaSpeaking();
    };
  }, []);

  const stopSpeaking = useCallback(() => {
    stopAquaSpeaking();
    dispatch({
      type: 'UPDATE_AQUA_STATE',
      patch: { status: 'idle' },
    });
    dispatch({
      type: 'SET_DEVICE_INTERFACE_STATUS',
      voiceStatus: stateRef.current.aqua.micSupported ? 'ready' : 'unavailable',
    });
  }, [dispatch]);

  const submitQuery = useCallback(
    async (rawText: string, inputMethod: 'text' | 'voice' = 'text') => {
      const clean = rawText.trim();
      if (!clean) return;

      stopAquaSpeaking();
      const current = stateRef.current;

      dispatch({
        type: 'APPEND_AQUA_MESSAGE',
        message: {
          id: `user-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'user',
          text: clean,
          language: current.aqua.language,
          inputMethod,
          timestamp: Date.now(),
        },
      });

      dispatch({
        type: 'UPDATE_AQUA_STATE',
        patch: {
          status: 'thinking',
          transcriptInterim: '',
          ...(inputMethod === 'text'
            ? { lastVoiceTranscript: '', transcriptConfidence: null }
            : {}),
        },
      });
      dispatch({
        type: 'SET_DEVICE_INTERFACE_STATUS',
        voiceStatus: 'processing',
      });

      const outcome = await runAquaTurn(clean, stateRef.current, (name, params) =>
        dispatchAction(name, params, 'aqua')
      );

      dispatch({
        type: 'UPDATE_AQUA_STATE',
        patch: {
          aiMode: outcome.mode,
          aiReason: outcome.reason,
          lastDiscussedTopic: outcome.lastDiscussedTopic,
          lastModifiedParam: outcome.lastModifiedParam,
        },
      });
      dispatch({
        type: 'SET_AQUA_PENDING_CONFIRMATION',
        confirmation: outcome.pendingConfirmation,
      });

      dispatch({
        type: 'APPEND_AQUA_MESSAGE',
        message: {
          id: `aqua-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          role: 'aqua',
          text: outcome.replyText,
          spokenText: outcome.spokenText,
          language: stateRef.current.aqua.language,
          mode: outcome.mode,
          executedActions: outcome.executedActions,
          timestamp: Date.now(),
        },
      });

      const latest = stateRef.current;
      if (latest.aqua.ttsEnabled && latest.aqua.ttsSupported) {
        const res = speakAquaText(outcome.spokenText, latest.aqua.language, {
          onStart: () => {
            dispatch({ type: 'UPDATE_AQUA_STATE', patch: { status: 'speaking' } });
          },
          onEnd: () => {
            dispatch({ type: 'UPDATE_AQUA_STATE', patch: { status: 'idle' } });
            dispatch({
              type: 'SET_DEVICE_INTERFACE_STATUS',
              voiceStatus: latest.aqua.micSupported ? 'ready' : 'unavailable',
            });
          },
          onError: () => {
            dispatch({ type: 'UPDATE_AQUA_STATE', patch: { status: 'idle' } });
          },
        });
        if (res.voiceMissingForLang) {
          dispatch({
            type: 'UPDATE_AQUA_STATE',
            patch: { status: 'idle', ttsLanguageSupported: false },
          });
        } else if (!res.started) {
          dispatch({ type: 'UPDATE_AQUA_STATE', patch: { status: 'idle' } });
        }
      } else {
        dispatch({ type: 'UPDATE_AQUA_STATE', patch: { status: 'idle' } });
        dispatch({
          type: 'SET_DEVICE_INTERFACE_STATUS',
          voiceStatus: latest.aqua.micSupported ? 'ready' : 'unavailable',
        });
      }
    },
    [dispatch, dispatchAction]
  );

  const stopListening = useCallback(() => {
    speechServiceRef.current?.stopListening();
    dispatch({
      type: 'UPDATE_AQUA_STATE',
      patch: { status: 'idle' },
    });
    dispatch({
      type: 'SET_DEVICE_INTERFACE_STATUS',
      voiceStatus: stateRef.current.aqua.micSupported ? 'ready' : 'unavailable',
    });
  }, [dispatch]);

  const startListening = useCallback(
    (onTranscriptReady?: (finalText: string) => void) => {
      stopAquaSpeaking();
      const svc = speechServiceRef.current;
      if (!svc) return;

      svc.activateMicrophone(stateRef.current.aqua.language, {
        onStateChange: (snap) => {
          const nextAquaStatus =
            snap.phase === 'listening' || snap.phase === 'requesting'
              ? 'listening'
              : stateRef.current.aqua.status === 'listening'
                ? 'idle'
                : stateRef.current.aqua.status;

          dispatch({
            type: 'UPDATE_AQUA_STATE',
            patch: {
              micPermission: snap.micPermission,
              status: nextAquaStatus,
              transcriptInterim: snap.interimTranscript,
              transcriptConfidence: snap.confidence,
              ...(snap.phase === 'requesting' ? { lastVoiceTranscript: '' } : {}),
            },
          });
          dispatch({
            type: 'SET_DEVICE_INTERFACE_STATUS',
            voiceStatus: snap.deviceStatus,
          });
        },
        onInterimTranscript: (interim) => {
          onTranscriptReady?.(interim);
        },
        onFinalTranscript: (finalText, snap) => {
          dispatch({
            type: 'UPDATE_AQUA_STATE',
            patch: {
              lastVoiceTranscript: finalText,
              transcriptConfidence: snap.confidence,
            },
          });
          onTranscriptReady?.(finalText);
          if (stateRef.current.aqua.autoSendVoice) {
            void submitQuery(finalText, 'voice');
          } else {
            dispatch({ type: 'UPDATE_AQUA_STATE', patch: { status: 'idle' } });
          }
        },
        onError: (_code, friendlyMessage) => {
          dispatch({
            type: 'APPEND_AQUA_MESSAGE',
            message: {
              id: `sys-err-${Date.now()}`,
              role: 'system',
              text: friendlyMessage,
              language: stateRef.current.aqua.language,
              timestamp: Date.now(),
            },
          });
        },
      });
    },
    [dispatch, submitQuery]
  );

  const confirmPending = useCallback(
    (approved: boolean) => {
      const pending = stateRef.current.aqua.pendingConfirmation;
      if (!pending) return;
      if (approved) {
        void submitQuery('confirm', 'text');
      } else {
        void submitQuery('cancel', 'text');
      }
    },
    [submitQuery]
  );

  const setLanguage = useCallback(
    (language: AquaLanguage) => {
      dispatchAction('set_aqua_language', { language }, 'mouse');
    },
    [dispatchAction]
  );

  return {
    submitQuery,
    startListening,
    stopListening,
    stopSpeaking,
    confirmPending,
    setLanguage,
  };
}
