import { AquaLanguage, DeviceInterfaceStatus } from '../types/exhibition';

export type ListeningModePhase =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'stopped'
  | 'error'
  | 'unsupported';

export type MicrophonePermissionState =
  | 'idle'
  | 'requesting'
  | 'granted'
  | 'denied'
  | 'unsupported';

export interface SpeechServiceSnapshot {
  supported: boolean;
  phase: ListeningModePhase;
  micPermission: MicrophonePermissionState;
  language: AquaLanguage;
  localeTag: string;
  interimTranscript: string;
  finalTranscript: string;
  confidence: number | null;
  errorCode: string | null;
  errorMessage: string | null;
  deviceStatus: DeviceInterfaceStatus;
  startedAt: number | null;
}

export interface SpeechServiceListeners {
  onStateChange?: (snapshot: SpeechServiceSnapshot) => void;
  onInterimTranscript?: (transcript: string, snapshot: SpeechServiceSnapshot) => void;
  onFinalTranscript?: (transcript: string, snapshot: SpeechServiceSnapshot) => void;
  onError?: (errorCode: string, friendlyMessage: string, snapshot: SpeechServiceSnapshot) => void;
}

export interface SpeechRecognitionAlternativeLike {
  transcript: string;
  confidence: number;
}

export interface SpeechRecognitionResultLike {
  isFinal: boolean;
  length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}

export interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: SpeechRecognitionResultLike;
  };
}

export interface SpeechRecognitionErrorEventLike {
  error: string;
  message?: string;
}

export interface SpeechRecognitionInstanceLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

export type SpeechRecognitionConstructorLike = new () => SpeechRecognitionInstanceLike;

export const SPEECH_LOCALE_BY_LANGUAGE: Record<AquaLanguage, string> = {
  en: 'en-IN',
  ml: 'ml-IN',
  hi: 'hi-IN',
};

export function resolveSpeechRecognitionConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const win = window as unknown as Record<string, unknown>;
  const ctor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
  return typeof ctor === 'function' ? (ctor as SpeechRecognitionConstructorLike) : null;
}

export function isSpeechRecognitionSupported(): boolean {
  return resolveSpeechRecognitionConstructor() !== null;
}

export function mapSpeechError(code: string): {
  code: string;
  message: string;
  permission?: MicrophonePermissionState;
} {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return {
      code: 'PERMISSION_DENIED',
      message:
        'Microphone permission was denied. Allow microphone access in your browser settings or type your command below.',
      permission: 'denied',
    };
  }
  if (code === 'audio-capture') {
    return {
      code: 'NO_MICROPHONE',
      message: 'No microphone device was detected. You can continue using text chat.',
    };
  }
  if (code === 'language-not-supported') {
    return {
      code: 'LANGUAGE_UNSUPPORTED',
      message:
        'Browser speech recognition does not support this language on your device. Please type your message or switch to English voice.',
    };
  }
  if (code === 'no-speech') {
    return {
      code: 'NO_SPEECH',
      message: 'No speech detected. Speak clearly closer to your microphone and try again.',
    };
  }
  if (code === 'aborted') {
    return {
      code: 'ABORTED',
      message: 'Listening was stopped.',
    };
  }
  return {
    code: code.toUpperCase(),
    message: `Voice recognition stopped (${code}). You can retry or type your message below.`,
  };
}

/**
 * Stateful Web Speech API recognition controller managing microphone activation,
 * interim/final transcript generation, and AQUA's listening-mode transitions.
 */
export class AquaSpeechRecognitionService {
  private recognition: SpeechRecognitionInstanceLike | null = null;
  private listeners: SpeechServiceListeners = {};
  private finalDispatchedForSession = false;
  private snapshot: SpeechServiceSnapshot;

  constructor(initialLanguage: AquaLanguage = 'en') {
    const supported = isSpeechRecognitionSupported();
    this.snapshot = {
      supported,
      phase: supported ? 'idle' : 'unsupported',
      micPermission: supported ? 'idle' : 'unsupported',
      language: initialLanguage,
      localeTag: SPEECH_LOCALE_BY_LANGUAGE[initialLanguage],
      interimTranscript: '',
      finalTranscript: '',
      confidence: null,
      errorCode: null,
      errorMessage: null,
      deviceStatus: supported ? 'ready' : 'unavailable',
      startedAt: null,
    };
  }

  public getState(): SpeechServiceSnapshot {
    return { ...this.snapshot };
  }

  public setLanguage(language: AquaLanguage): SpeechServiceSnapshot {
    this.updateState({
      language,
      localeTag: SPEECH_LOCALE_BY_LANGUAGE[language],
    });
    return this.getState();
  }

  public subscribe(listeners: SpeechServiceListeners): void {
    this.listeners = { ...listeners };
  }

  /**
   * Activates microphone speech recognition only when explicitly requested by the visitor.
   */
  public activateMicrophone(
    language: AquaLanguage = this.snapshot.language,
    listeners?: SpeechServiceListeners
  ): boolean {
    if (listeners) {
      this.subscribe(listeners);
    }

    const Ctor = resolveSpeechRecognitionConstructor();
    if (!Ctor) {
      const msg =
        'Voice recognition is not supported in this browser. Type your question or command below.';
      this.updateState({
        supported: false,
        phase: 'unsupported',
        micPermission: 'unsupported',
        deviceStatus: 'unavailable',
        errorCode: 'UNSUPPORTED',
        errorMessage: msg,
      });
      this.listeners.onError?.('UNSUPPORTED', msg, this.getState());
      return false;
    }

    // Abort any prior active instance cleanly before starting a fresh listening session
    if (this.recognition) {
      this.abort();
    }

    this.finalDispatchedForSession = false;
    this.updateState({
      supported: true,
      language,
      localeTag: SPEECH_LOCALE_BY_LANGUAGE[language],
      phase: 'requesting',
      micPermission: 'requesting',
      deviceStatus: 'listening',
      interimTranscript: '',
      finalTranscript: '',
      confidence: null,
      errorCode: null,
      errorMessage: null,
      startedAt: Date.now(),
    });

    try {
      const instance = new Ctor();
      instance.lang = SPEECH_LOCALE_BY_LANGUAGE[language];
      instance.interimResults = true;
      instance.continuous = false;
      instance.maxAlternatives = 1;

      instance.onstart = () => {
        this.updateState({
          phase: 'listening',
          micPermission: 'granted',
          deviceStatus: 'listening',
          errorCode: null,
          errorMessage: null,
        });
      };

      instance.onresult = (event: SpeechRecognitionEventLike) => {
        let interim = '';
        let finalChunk = '';
        let bestConfidence: number | null = null;

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const alt = result[0];
          const text = alt?.transcript ?? '';
          if (typeof alt?.confidence === 'number' && Number.isFinite(alt.confidence) && alt.confidence > 0) {
            bestConfidence = Math.min(1, Math.max(0, alt.confidence));
          }
          if (result.isFinal) {
            finalChunk += text;
          } else {
            interim += text;
          }
        }

        const cleanInterim = interim.trim();
        const cleanFinal = finalChunk.trim();

        if (cleanInterim) {
          this.updateState({
            interimTranscript: cleanInterim,
            ...(bestConfidence !== null ? { confidence: bestConfidence } : {}),
          });
          this.listeners.onInterimTranscript?.(cleanInterim, this.getState());
        }

        if (cleanFinal && !this.finalDispatchedForSession) {
          this.finalDispatchedForSession = true;
          this.updateState({
            interimTranscript: cleanFinal,
            finalTranscript: cleanFinal,
            ...(bestConfidence !== null ? { confidence: bestConfidence } : {}),
          });
          this.listeners.onFinalTranscript?.(cleanFinal, this.getState());
        }
      };

      instance.onerror = (ev: SpeechRecognitionErrorEventLike) => {
        const mapped = mapSpeechError(ev.error || 'unknown');
        this.recognition = null;
        this.updateState({
          phase: 'error',
          micPermission: mapped.permission ?? this.snapshot.micPermission,
          deviceStatus: mapped.permission === 'denied' ? 'unavailable' : 'ready',
          errorCode: mapped.code,
          errorMessage: mapped.message,
        });
        if (mapped.code !== 'ABORTED') {
          this.listeners.onError?.(mapped.code, mapped.message, this.getState());
        }
      };

      instance.onend = () => {
        this.recognition = null;
        if (this.snapshot.phase === 'listening' || this.snapshot.phase === 'requesting') {
          this.updateState({
            phase: 'stopped',
            deviceStatus: this.snapshot.supported ? 'ready' : 'unavailable',
          });
        }
      };

      this.recognition = instance;
      instance.start();
      return true;
    } catch {
      this.recognition = null;
      const msg =
        'Unable to start browser voice recognition. Check microphone access or type your message below.';
      this.updateState({
        phase: 'error',
        deviceStatus: 'ready',
        errorCode: 'START_FAILED',
        errorMessage: msg,
      });
      this.listeners.onError?.('START_FAILED', msg, this.getState());
      return false;
    }
  }

  public stopListening(): void {
    const rec = this.recognition;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // Ignore already-stopped recognition errors
      }
      this.recognition = null;
    }
    this.updateState({
      phase: 'stopped',
      deviceStatus: this.snapshot.supported ? 'ready' : 'unavailable',
    });
  }

  public abort(): void {
    const rec = this.recognition;
    if (rec) {
      try {
        rec.abort();
      } catch {
        // Ignore abort errors
      }
      this.recognition = null;
    }
    this.updateState({
      phase: this.snapshot.supported ? 'idle' : 'unsupported',
      deviceStatus: this.snapshot.supported ? 'ready' : 'unavailable',
    });
  }

  public resetTranscript(): void {
    this.updateState({
      interimTranscript: '',
      finalTranscript: '',
      confidence: null,
      errorCode: null,
      errorMessage: null,
      phase: this.snapshot.supported ? 'idle' : 'unsupported',
    });
  }

  private updateState(patch: Partial<SpeechServiceSnapshot>): void {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
    };
    this.listeners.onStateChange?.(this.getState());
  }
}
