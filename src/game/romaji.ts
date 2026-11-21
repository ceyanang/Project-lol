import { KANA_BY_ID } from '../data';

/** Alternate romanizations accepted when typing (Hepburn is the main one). */
const ALTERNATES: Record<string, string[]> = {
  shi: ['si'],
  chi: ['ti'],
  tsu: ['tu'],
  fu: ['hu'],
  ji: ['zi', 'di'],
  zu: ['du'],
  n: ['nn'],
  wo: ['o'],
};

/** Clean up what the player typed: lowercase letters only. */
export function normalizeTyped(typed: string): string {
  return typed.toLowerCase().replace(/[^a-z]/g, '');
}

/** Every accepted spelling for a kana id. */
export function kanaReadings(kanaId: string): string[] {
  const r = KANA_BY_ID[kanaId]?.romaji;
  return r ? [r, ...(ALTERNATES[r] ?? [])] : [];
}

/** Every accepted spelling for a sequence of kana (a word), e.g. すし → sushi, susi. */
export function readingsOf(kanaIds: readonly string[]): string[] {
  let out = [''];
  for (const k of kanaIds) {
    const opts = kanaReadings(k);
    out = out.flatMap((prefix) => opts.map((o) => prefix + o));
    if (out.length > 64) out = out.slice(0, 64); // plenty for real words
  }
  return out;
}

export function matchesReading(kanaIds: readonly string[], typed: string): boolean {
  const t = normalizeTyped(typed);
  return t.length > 0 && readingsOf(kanaIds).includes(t);
}

/** Edit distance, used to guess which move a typo was aiming at (for the SRS miss). */
export function editDistance(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return dp[a.length][b.length];
}
