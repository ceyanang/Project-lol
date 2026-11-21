import { KANA_BY_ID } from '../data';

/** Alternative romanizations accepted when typing (Hepburn is the main one). */
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

export function acceptedReadings(kanaId: string): string[] {
  const r = KANA_BY_ID[kanaId]?.romaji;
  if (!r) return [];
  return [r, ...(ALTERNATES[r] ?? [])];
}

export function isCorrectTyped(kanaId: string, typed: string): boolean {
  const t = typed.trim().toLowerCase();
  return acceptedReadings(kanaId).includes(t);
}
