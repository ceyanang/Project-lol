import { KANA_BY_ID } from '../data';
/**
 * Japanese text-to-speech via window.speechSynthesis (no audio files).
 * Side-effect module: only UI code calls it.
 */

let jaVoice: SpeechSynthesisVoice | null = null;
let voicesLoaded = false;

export function speechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

function pickVoice(): SpeechSynthesisVoice | null {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (voices.length) voicesLoaded = true;
  const ja = voices.filter((v) => v.lang.toLowerCase().replace('_', '-').startsWith('ja'));
  // prefer on-device voices so it works offline
  return ja.find((v) => v.localService) ?? ja[0] ?? null;
}

export function initSpeech(onChange?: () => void) {
  if (!speechSupported()) return;
  jaVoice = pickVoice();
  window.speechSynthesis.addEventListener?.('voiceschanged', () => {
    jaVoice = pickVoice();
    onChange?.();
  });
}

export function hasJapaneseVoice(): boolean {
  if (!jaVoice) jaVoice = pickVoice();
  return !!jaVoice;
}

/** True once the browser has reported its voice list (so "no voice" is reliable). */
export function voicesKnown(): boolean {
  if (!voicesLoaded) pickVoice();
  return voicesLoaded;
}

export type SpeakResult = 'ok' | 'no-voice' | 'unsupported';

/**
 * Read a kana aloud. A bundled recording (public/audio/<romaji>.mp3, same file for hiragana and
 * katakana) plays when it exists, so it sounds the same on every phone and works offline;
 * otherwise (and for whole words) the device's Japanese voice is used.
 */
export function speakKana(text: string, onFallback?: (result: SpeakResult) => void): SpeakResult {
  const chars = [...text];
  const kana = chars.length === 1 ? KANA_BY_ID[chars[0]] : undefined;
  if (!kana || typeof Audio === 'undefined') return speak(text);
  try {
    const audio = new Audio(`${import.meta.env.BASE_URL}audio/${kana.romaji}.mp3`);
    let fell = false;
    const fallback = () => {
      if (!fell) {
        fell = true;
        onFallback?.(speak(text));
      }
    };
    audio.addEventListener('error', fallback);
    audio.play().catch(fallback);
    return 'ok';
  } catch {
    return speak(text);
  }
}

/**
 * Speak Japanese text. Even without a listed Japanese voice we still try with lang=ja-JP —
 * some browsers speak it anyway — but report 'no-voice' so the UI can show a hint.
 */
export function speak(text: string, rate = 0.8): SpeakResult {
  if (!speechSupported()) return 'unsupported';
  const synth = window.speechSynthesis;
  const voice = jaVoice ?? pickVoice();
  try {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate;
    if (voice) u.voice = voice;
    synth.speak(u);
  } catch {
    return 'unsupported';
  }
  return voice ? 'ok' : 'no-voice';
}

export const VOICE_HELP =
  'No Japanese voice found on this device, so kana may not be read aloud. ' +
  'iPhone/iPad: Settings › Accessibility › Spoken Content › Voices › Japanese. ' +
  'Android: Settings › System › Languages & input › Text-to-speech › install Japanese voice data. ' +
  'Windows: Settings › Time & language › Speech › Add voices › Japanese. macOS: System Settings › Accessibility › Spoken Content › System voice › Manage Voices.';
