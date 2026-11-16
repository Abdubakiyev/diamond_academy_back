import { PartFormat, QuestionType, Skill } from '@prisma/client';

/** Qaysi bo'limda (skill) qaysi part formatlari ruxsat etiladi */
export const SKILL_FORMATS: Record<Skill, PartFormat[]> = {
  [Skill.LISTENING]: [
    PartFormat.MCQ,
    PartFormat.MATCHING_BANK,
    PartFormat.MAP_LABELING,
    PartFormat.TRUE_FALSE_NG,
    PartFormat.GAP_FILL,
    PartFormat.MIXED,
  ],
  [Skill.READING]: [
    PartFormat.MCQ,
    PartFormat.MATCHING_BANK,
    PartFormat.TRUE_FALSE_NG,
    PartFormat.GAP_FILL,
    PartFormat.MIXED,
  ],
  [Skill.WRITING]: [PartFormat.WRITING_TASK],
  [Skill.SPEAKING]: [
    PartFormat.SPEAKING_INTERVIEW,
    PartFormat.SPEAKING_PICTURE,
    PartFormat.SPEAKING_DISCUSSION,
  ],
};

/** Part formatiga qarab qaysi savol turlari ruxsat etiladi */
export const FORMAT_QUESTION_TYPES: Record<PartFormat, QuestionType[]> = {
  [PartFormat.MCQ]: [QuestionType.MULTIPLE_CHOICE],
  [PartFormat.MATCHING_BANK]: [QuestionType.MATCHING],
  [PartFormat.MAP_LABELING]: [QuestionType.MATCHING],
  [PartFormat.TRUE_FALSE_NG]: [QuestionType.TRUE_FALSE_NG],
  [PartFormat.GAP_FILL]: [QuestionType.SHORT_ANSWER],
  [PartFormat.MIXED]: [
    QuestionType.MULTIPLE_CHOICE,
    QuestionType.TRUE_FALSE_NG,
    QuestionType.SHORT_ANSWER,
    QuestionType.MATCHING,
  ],
  [PartFormat.WRITING_TASK]: [QuestionType.WRITING_PROMPT],
  [PartFormat.SPEAKING_INTERVIEW]: [QuestionType.SPEAKING_PROMPT],
  [PartFormat.SPEAKING_PICTURE]: [QuestionType.SPEAKING_PROMPT],
  [PartFormat.SPEAKING_DISCUSSION]: [QuestionType.SPEAKING_PROMPT],
};

/** Variantlar banki (A-H) ishlatiladigan formatlar */
export const BANK_FORMATS: PartFormat[] = [PartFormat.MATCHING_BANK, PartFormat.MAP_LABELING, PartFormat.MIXED];

/** Storage papkalari (StorageService UploadPurpose bilan mos) */
export const EXAM_AUDIO_PREFIX = 'exams/audio/';
export const EXAM_IMAGE_PREFIX = 'exams/images/';
