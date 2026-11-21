import type { SrsStats } from './srs';

export const PROFILE_KEY = 'kanaslayer.profile.v1';
/** v2: move-deck combat. Old v1 runs are dropped; the profile (unlocks + SRS) carries over. */
export const RUN_KEY = 'kanaslayer.run.v2';

export interface Profile {
  version: 1;
  /** Number of UNLOCK_GROUPS unlocked (always ≥ 1). */
  unlockedCount: number;
  srs: SrsStats;
  runs: number;
  wins: number;
  bestFloor: number;
  settings: { autoSpeak: boolean; sfx: boolean };
}

export function newProfile(): Profile {
  return { version: 1, unlockedCount: 1, srs: {}, runs: 0, wins: 0, bestFloor: 0, settings: { autoSpeak: true, sfx: true } };
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
    unlockedCount: Math.max(1, num(raw.unlockedCount, 1)),
    srs,
    runs: num(raw.runs, 0),
    wins: num(raw.wins, 0),
    bestFloor: num(raw.bestFloor, 0),
    settings: {
      autoSpeak: isObj(raw.settings) && typeof raw.settings.autoSpeak === 'boolean' ? raw.settings.autoSpeak : true,
      sfx: isObj(raw.settings) && typeof raw.settings.sfx === 'boolean' ? raw.settings.sfx : true,
    },
  };
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
