import { AquaLanguage } from '../types/exhibition';
import {
  AquaSpeechRecognitionService,
  SPEECH_LOCALE_BY_LANGUAGE,
  isSpeechRecognitionSupported,
  type SpeechServiceSnapshot,
} from './speechService';

export interface SpeechCapabilityReport {
  recognitionSupported: boolean;
  synthesisSupported: boolean;
  ttsVoicesAvailableForLang: Record<AquaLanguage, boolean>;
}

const SYNTHESIS_PREFIX_MAP: Record<AquaLanguage, string> = {
  en: 'en',
  ml: 'ml',
  hi: 'hi',
};

export function getSpeechCapabilities(): SpeechCapabilityReport {
  if (typeof window === 'undefined') {
    return {
      recognitionSupported: false,
      synthesisSupported: false,
      ttsVoicesAvailableForLang: { en: false, ml: false, hi: false },
    };
  }
  const recognitionSupported = isSpeechRecognitionSupported();
  const synthesisSupported =
    'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

  const voices = synthesisSupported ? window.speechSynthesis.getVoices() : [];
  const hasVoice = (lang: AquaLanguage): boolean => {
    if (!synthesisSupported) return false;
    if (voices.length === 0) return lang === 'en';
    const prefix = SYNTHESIS_PREFIX_MAP[lang];
    return voices.some((v) => v.lang.toLowerCase().startsWith(prefix));
  };

  return {
    recognitionSupported,
    synthesisSupported,
    ttsVoicesAvailableForLang: {
      en: hasVoice('en'),
      ml: hasVoice('ml'),
      hi: hasVoice('hi'),
    },
  };
}

export function sanitizeForSpeech(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/^#+\s+/gm, '')
    .replace(/[-•]\s+/g, '')
    .replace(/ML\/d/g, 'megalitres per day')
    .replace(/L\/hr/g, 'litres per hour')
    .replace(/kWh\/m³/g, 'kilowatt hours per cubic meter')
    .replace(/m³\/s/g, 'cubic meters per second')
    .replace(/m²/g, 'square meters')
    .replace(/km³/g, 'cubic kilometers')
    .replace(/\s+/g, ' ')
    .trim();
}

export function findVoiceForLanguage(language: AquaLanguage): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length === 0) return null;

  const target = language === 'ml' ? 'ml-in' : language === 'hi' ? 'hi-in' : 'en-in';
  const exact = voices.find((v) => v.lang.toLowerCase() === target);
  if (exact) return exact;

  const prefix = SYNTHESIS_PREFIX_MAP[language];
  const byPrefix = voices.find((v) => v.lang.toLowerCase().startsWith(prefix));
  if (byPrefix) return byPrefix;

  return null;
}

export function speakAquaText(
  text: string,
  language: AquaLanguage,
  callbacks: {
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  } = {}
): { started: boolean; voiceMissingForLang: boolean } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    callbacks.onEnd?.();
    return { started: false, voiceMissingForLang: true };
  }

  try {
    window.speechSynthesis.cancel();
    const clean = sanitizeForSpeech(text);
    if (!clean) {
      callbacks.onEnd?.();
      return { started: false, voiceMissingForLang: false };
    }

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = findVoiceForLanguage(language);
    const voiceMissingForLang = voices.length > 0 && !matchedVoice && language !== 'en';

    if (voiceMissingForLang) {
      callbacks.onEnd?.();
      return { started: false, voiceMissingForLang: true };
    }

    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = SPEECH_LOCALE_BY_LANGUAGE[language];
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }
    utterance.rate = 1.02;
    utterance.pitch = 1.0;

    utterance.onstart = () => callbacks.onStart?.();
    utterance.onend = () => callbacks.onEnd?.();
    utterance.onerror = () => callbacks.onError?.();

    window.speechSynthesis.speak(utterance);
    return { started: true, voiceMissingForLang: false };
  } catch {
    callbacks.onError?.();
    return { started: false, voiceMissingForLang: true };
  }
}

export function stopAquaSpeaking(): void {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      // Ignore browser quirks on cancel
    }
  }
}

export interface RecognitionSessionCallbacks {
  onStart?: () => void;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (errorCode: string, friendlyMessage: string) => void;
  onEnd?: () => void;
}

export function startSpeechRecognitionSession(
  language: AquaLanguage,
  callbacks: RecognitionSessionCallbacks
): { stop: () => void; abort: () => void; getState: () => SpeechServiceSnapshot } | null {
  const service = new AquaSpeechRecognitionService(language);
  let startNotified = false;
  let endNotified = false;

  const started = service.activateMicrophone(language, {
    onStateChange: (snap) => {
      if (snap.phase === 'listening' && !startNotified) {
        startNotified = true;
        callbacks.onStart?.();
      }
      if ((snap.phase === 'stopped' || snap.phase === 'idle') && !endNotified) {
        endNotified = true;
        callbacks.onEnd?.();
      }
    },
    onInterimTranscript: (text) => callbacks.onInterim?.(text),
    onFinalTranscript: (text) => callbacks.onFinal?.(text),
    onError: (code, msg) => callbacks.onError?.(code, msg),
  });

  if (!started) return null;

  return {
    stop: () => service.stopListening(),
    abort: () => service.abort(),
    getState: () => service.getState(),
  };
}

export { AquaSpeechRecognitionService };
