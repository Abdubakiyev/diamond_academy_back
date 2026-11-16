import { IsEnum, IsInt, IsNotEmpty, IsString, Max, MaxLength, Min } from 'class-validator';

/** Fayl nima uchun yuklanayotgani — ruxsat, turi va hajm cheklovini belgilaydi */
export enum UploadPurpose {
  LESSON_VIDEO = 'LESSON_VIDEO', // admin / o'qituvchi
  LESSON_RESOURCE = 'LESSON_RESOURCE', // admin / o'qituvchi
  EXAM_AUDIO = 'EXAM_AUDIO', // admin / o'qituvchi
  EXAM_IMAGE = 'EXAM_IMAGE', // admin / o'qituvchi
  SUBMISSION_FILE = 'SUBMISSION_FILE', // o'quvchi (vazifa rasmi)
  SPEAKING_AUDIO = 'SPEAKING_AUDIO', // o'quvchi (speaking yozuvi)
}

export class PresignDto {
  @IsEnum(UploadPurpose)
  purpose!: UploadPurpose;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  fileName!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  contentType!: string;

  /** Fayl hajmi (bayt) */
  @IsInt()
  @Min(1)
  @Max(2 * 1024 * 1024 * 1024)
  sizeBytes!: number;
}
