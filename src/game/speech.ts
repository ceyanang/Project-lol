import { KANA_BY_ID } from '../data';
import { getAudioContext } from './sfx';
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

const BASE = import.meta.env.BASE_URL;
/** Decoded voice clips by reading. null = this clip doesn't exist (use the device voice). */
const clips = new Map<string, AudioBuffer | null>();
const loading = new Set<string>();
let clipHits = 0;
let clipMisses = 0;

async function loadClip(ac: AudioContext, reading: string) {
  if (clips.has(reading) || loading.has(reading)) return;
  // no recordings bundled at all (first few all missing): stop asking
  if (clipHits === 0 && clipMisses >= 3) return;
  loading.add(reading);
  try {
    const res = await fetch(`${BASE}audio/${reading}.mp3`);
    if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) throw new Error('missing');
    clips.set(reading, await ac.decodeAudioData(await res.arrayBuffer()));
    clipHits++;
  } catch {
    clips.set(reading, null);
    clipMisses++;
  } finally {
    loading.delete(reading);
  }
}

/** Fetch and decode voice clips ahead of time so they play instantly. Safe to call repeatedly. */
export function preloadClips(readings: Iterable<string>) {
  const ac = getAudioContext();
  if (!ac) return;
  for (const r of new Set(readings)) void loadClip(ac, r);
}

/**
 * Read a kana aloud. A bundled recording (public/audio/<romaji>.mp3, same file for hiragana and
 * katakana) plays instantly from memory once preloaded, so it sounds the same on every phone and
 * works offline. If the clip is missing (or not loaded yet), and for whole words, the device's
 * Japanese voice is used.
 */
export function speakKana(text: string, onFallback?: (result: SpeakResult) => void): SpeakResult {
  const chars = [...text];
  const kana = chars.length === 1 ? KANA_BY_ID[chars[0]] : undefined;
  const ac = kana ? getAudioContext() : null;
  if (!kana || !ac) return speak(text);
  const buffer = clips.get(kana.romaji);
  if (buffer) {
    try {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) window.speechSynthesis.cancel();
      const src = ac.createBufferSource();
      src.buffer = buffer;
      src.connect(ac.destination);
      src.start();
      return 'ok';
    } catch {
      // fall through to the device voice
    }
  } else if (buffer === undefined) {
    void loadClip(ac, kana.romaji); // ready for next time
  }
  const res = speak(text);
  onFallback?.(res);
  return res;
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
