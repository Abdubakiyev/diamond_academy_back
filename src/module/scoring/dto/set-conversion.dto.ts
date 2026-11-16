import { Skill } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class ConversionRowDto {
  /** To'g'ri javoblar soni */
  @IsInt()
  @Min(0)
  @Max(200)
  rawScore!: number;

  /** 0-75 shkaladagi ball */
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(75)
  scaledScore!: number;
}

/** Jadvalni to'liq almashtiradi (examId berilmasa — umumiy / default jadval, faqat ADMIN) */
export class SetConversionDto {
  @IsOptional()
  @IsUUID()
  examId?: string;

  /** Faqat LISTENING yoki READING (Writing / Speaking AI orqali to'g'ridan-to'g'ri 0-75 olinadi) */
  @IsEnum(Skill)
  skill!: Skill;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(201)
  @ValidateNested({ each: true })
  @Type(() => ConversionRowDto)
  rows!: ConversionRowDto[];
}
