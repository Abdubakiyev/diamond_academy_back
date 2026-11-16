import { ExamType, Skill } from '@prisma/client';
import {
  ArrayUnique,
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateExamDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  description?: string;

  /**
   * FULL_MULTILEVEL — 4 ta bo'lim (Listening, Reading, Writing, Speaking) avtomatik yaratiladi.
   * CUSTOM — admin o'zi tanlagan bo'limlar va umumiy vaqt (durationMinutes) bilan alohida test.
   */
  @IsOptional()
  @IsEnum(ExamType)
  type?: ExamType;

  @IsOptional()
  @IsUUID()
  levelId?: string;

  /** Narx (so'm). 0 yoki berilmasa — bepul test */
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1_000_000_000)
  price?: number;

  /** Faqat CUSTOM uchun: umumiy vaqt (daqiqa) */
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(600)
  durationMinutes?: number;

  /** Faqat CUSTOM uchun: boshida yaratiladigan bo'limlar (keyin ham qo'shish mumkin) */
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(Skill, { each: true })
  skills?: Skill[];
}
