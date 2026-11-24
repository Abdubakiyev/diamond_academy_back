import { CefrLevel } from '@prisma/client';

/**
 * Multilevel ball hisoblash yordamchilari.
 * Manba: rasmiy "Chet tilini bilish darajasini aniqlash (multilevel)" jadvali.
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

// ---------------------------------------------------------------------------
// LISTENING / READING: to'g'ri javoblar soni -> 0-75 (rasmiy jadval)
// index = to'g'ri javoblar soni (0..35), qiymat = ball. 0 jadvalda yo'q, 0 deb olindi.
// ---------------------------------------------------------------------------

export const LISTENING_TABLE: readonly number[] = [
  0, 23, 26, 28, 30, 33, 34, 36, 38, 39, 41, 42, 44, 45, 47, 48, 50, 51, 53,
  54, 55, 57, 58, 60, 61, 63, 65, 66, 68, 70, 72, 73, 74, 75, 75, 75,
];

export const READING_TABLE: readonly number[] = [
  0, 20, 24, 27, 29, 32, 34, 36, 38, 39, 41, 42, 44, 45, 46, 48, 49, 51, 52,
  54, 55, 57, 58, 60, 61, 63, 65, 66, 68, 70, 71, 73, 74, 75, 75, 75,
];

/** Jadvalda nechta savol nazarda tutilgan (35) */
export const TABLE_MAX_RAW = LISTENING_TABLE.length - 1;

/**
 * Listening / Reading uchun to'g'ri javoblar sonini rasmiy jadval bo'yicha 0-75 ga o'tkazadi.
 * Raw jadvaldan katta bo'lsa (masalan test 35 dan ko'p savolli) 75 dan oshmaydi.
 */
export function scaleFromTable(skill: 'LISTENING' | 'READING', raw: number): number {
  const table = skill === 'LISTENING' ? LISTENING_TABLE : READING_TABLE;
  const i = Math.max(0, Math.min(Math.round(raw), TABLE_MAX_RAW));
  return table[i];
}

/**
 * To'g'ri javoblar sonini 0-75 shkalaga o'tkazadi (chiziqli).
 * Faqat jadval qo'llanilmaydigan hollar uchun (masalan CUSTOM test) zaxira sifatida qoldirildi.
 */
export function linearScale(raw: number, maxRaw: number, maxScore = MAX_SKILL_SCORE) {
  if (maxRaw <= 0) return 0;
  return round1(clamp((raw / maxRaw) * maxScore, 0, maxScore));
}

// ---------------------------------------------------------------------------
// WRITING: Task 1 = 33% (24.75), Task 2 = 67% (50.25), jami 75
// ---------------------------------------------------------------------------

export const WRITING_TASK_WEIGHTS = { TASK_1: 0.33, TASK_2: 0.67 } as const;

/**
 * Har bir topshiriq uchun ulush (0..1) beriladi: AI/ustoz bergan ball / topshiriq maksimali.
 * Natija 0-75: task1 * 24.75 + task2 * 50.25
 */
export function writingScore(task1Ratio: number, task2Ratio: number): number {
  const r1 = clamp(task1Ratio, 0, 1);
  const r2 = clamp(task2Ratio, 0, 1);
  return round1(
    r1 * MAX_SKILL_SCORE * WRITING_TASK_WEIGHTS.TASK_1 +
      r2 * MAX_SKILL_SCORE * WRITING_TASK_WEIGHTS.TASK_2,
  );
}

// ---------------------------------------------------------------------------
// SPEAKING: 3 ta part, har biri alohida baholanadi, jami 75
// Partlar orasidagi taqsimot rasmda ko'rsatilmagan: hozircha teng (25 dan).
// ---------------------------------------------------------------------------

export const SPEAKING_PART_WEIGHTS = [1 / 3, 1 / 3, 1 / 3] as const;

/** Har bir part uchun ulush (0..1) beriladi (1, 2, 3-part tartibida). Natija 0-75. */
export function speakingScore(partRatios: number[]): number {
  const total = SPEAKING_PART_WEIGHTS.reduce((sum, w, i) => {
    const ratio = clamp(partRatios[i] ?? 0, 0, 1);
    return sum + ratio * MAX_SKILL_SCORE * w;
  }, 0);
  return round1(total);
}

// ---------------------------------------------------------------------------
// UMUMIY
// ---------------------------------------------------------------------------

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

/** Umumiy ball bo'yicha CEFR daraja. 38 dan past bo'lsa BELOW_B1 (sertifikat berilmaydi). */
export function cefrFromScore(total: number): CefrLevel {
  const s = Math.round(total);
  if (s >= CEFR_MIN_SCORE.C1) return CefrLevel.C1;
  if (s >= CEFR_MIN_SCORE.B2) return CefrLevel.B2;
  if (s >= CEFR_MIN_SCORE.B1) return CefrLevel.B1;
  return CefrLevel.BELOW_B1;
}
