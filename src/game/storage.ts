import { UNLOCK_GROUPS, firstGroups } from '../data';
import type { SrsStats } from './srs';

export const PROFILE_KEY = 'kanaslayer.profile.v1';
/** v3: typed move-deck combat. Older runs are dropped; the profile (unlocks + SRS) carries over. */
export const RUN_KEY = 'kanaslayer.run.v3';

export type KeyboardMode = 'game' | 'phone';

export interface Profile {
  version: 1;
  /** Unlocked UNLOCK_GROUPS ids (always includes the あ row). Bosses unlock in order; the quiz can unlock any. */
  unlocked: string[];
  /** Unlocked groups switched off in Study focus (new unlocks start on). */
  studyOff: string[];
  srs: SrsStats;
  runs: number;
  wins: number;
  bestFloor: number;
  settings: {
    autoSpeak: boolean;
    sfx: boolean;
    /** Background music (on by default; separate from sound effects). */
    music: boolean;
    /** 'game' = in-game QWERTY keyboard (default); 'phone' = the device's own keyboard. */
    keyboard: KeyboardMode;
  };
}

export function newProfile(): Profile {
  return { version: 1, unlocked: firstGroups(1), studyOff: [], srs: {}, runs: 0, wins: 0, bestFloor: 0, settings: { autoSpeak: true, sfx: true, music: true, keyboard: 'game' } };
}

function safeGet(key: string): unknown {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full / private mode: the game keeps running in memory
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

export function loadProfile(): Profile {
  const raw = safeGet(PROFILE_KEY);
  const base = newProfile();
  if (!isObj(raw) || raw.version !== 1) return base;
  const srs: SrsStats = {};
  if (isObj(raw.srs)) {
    for (const [k, v] of Object.entries(raw.srs)) {
      if (isObj(v) && typeof v.seen === 'number' && typeof v.bucket === 'string') srs[k] = { ...base.srs[k], ...(v as object) } as SrsStats[string];
    }
  }
  const num = (v: unknown, d: number) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  return {
    version: 1,
    unlocked: parseUnlocked(raw),
    studyOff: parseStudyOff(raw),
    srs,
    runs: num(raw.runs, 0),
    wins: num(raw.wins, 0),
    bestFloor: num(raw.bestFloor, 0),
    settings: {
      autoSpeak: isObj(raw.settings) && typeof raw.settings.autoSpeak === 'boolean' ? raw.settings.autoSpeak : true,
      sfx: isObj(raw.settings) && typeof raw.settings.sfx === 'boolean' ? raw.settings.sfx : true,
      music: isObj(raw.settings) && typeof raw.settings.music === 'boolean' ? raw.settings.music : true,
      keyboard: isObj(raw.settings) && raw.settings.keyboard === 'phone' ? 'phone' : 'game',
    },
  };
}

/** Unlocked groups; migrates old saves that stored a count (`unlockedCount`). */
function parseUnlocked(raw: Record<string, unknown>): string[] {
  const valid = new Set(UNLOCK_GROUPS.map((g) => g.id));
  if (Array.isArray(raw.unlocked)) {
    const ids = raw.unlocked.filter((x): x is string => typeof x === 'string' && valid.has(x));
    return [...new Set([UNLOCK_GROUPS[0].id, ...ids])];
  }
  const n = typeof raw.unlockedCount === 'number' && Number.isFinite(raw.unlockedCount) ? raw.unlockedCount : 1;
  return firstGroups(n);
}

function parseStudyOff(raw: Record<string, unknown>): string[] {
  const valid = new Set(UNLOCK_GROUPS.map((g) => g.id));
  return Array.isArray(raw.studyOff) ? [...new Set(raw.studyOff.filter((x): x is string => typeof x === 'string' && valid.has(x)))] : [];
}

export function saveProfile(p: Profile) {
  safeSet(PROFILE_KEY, p);
}

/** Run saves are validated by the caller (see run.ts). */
export function loadRunRaw(): unknown {
  return safeGet(RUN_KEY);
}

export function saveRunRaw(run: unknown | null) {
  safeSet(RUN_KEY, run);
}
