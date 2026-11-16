import { CefrLevel } from '@prisma/client';

/**
 * Multilevel ball hisoblash yordamchilari.
 * Chegaralar tayyorlov manbalariga asoslangan (rasmiy emas) — kerak bo'lsa shu yerda o'zgartiring.
 */

/** Har bir skill (Listening / Reading / Writing / Speaking) maksimal bali */
export const MAX_SKILL_SCORE = 75;

/** CEFR chegaralari: umumiy (o'rtacha) ball butun songa yaxlitlangach solishtiriladi */
export const CEFR_MIN_SCORE = {
  C1: 65,
  B2: 51,
  B1: 38,
} as const;

export const round1 = (n: number) => Math.round(n * 10) / 10;

/** Ball 0 va max oralig'ida bo'lishini ta'minlaydi */
export const clamp = (n: number, min = 0, max = MAX_SKILL_SCORE) =>
  Math.min(max, Math.max(min, n));

/**
 * To'g'ri javoblar sonini 0-75 shkalaga o'tkazadi (chiziqli).
 * ScoreConversion jadvali kiritilmagan bo'lsa shu ishlatiladi.
 */
export function linearScale(raw: number, maxRaw: number, maxScore = MAX_SKILL_SCORE) {
  if (maxRaw <= 0) return 0;
  return round1(clamp((raw / maxRaw) * maxScore, 0, maxScore));
}

/** null / undefined ni tashlab, o'rtachani hisoblaydi. Hech narsa bo'lmasa null. */
export function average(values: Array<number | null | undefined>): number | null {
  const nums = values.filter((v): v is number => typeof v === 'number' && !Number.isNaN(v));
  if (nums.length === 0) return null;
  return round1(nums.reduce((a, b) => a + b, 0) / nums.length);
}

/** Vaznli o'rtacha: [{ value, weight }] */
export function weightedAverage(items: Array<{ value: number; weight: number }>): number | null {
  const totalWeight = items.reduce((a, i) => a + i.weight, 0);
  if (items.length === 0 || totalWeight <= 0) return null;
  return round1(items.reduce((a, i) => a + i.value * i.weight, 0) / totalWeight);
}

/** Umumiy ball bo'yicha CEFR daraja */
export function cefrFromScore(total: number): CefrLevel {
  const s = Math.round(total);
  if (s >= CEFR_MIN_SCORE.C1) return CefrLevel.C1;
  if (s >= CEFR_MIN_SCORE.B2) return CefrLevel.B2;
  if (s >= CEFR_MIN_SCORE.B1) return CefrLevel.B1;
  return CefrLevel.BELOW_B1;
}
