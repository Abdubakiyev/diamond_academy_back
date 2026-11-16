import { IsInt, IsNumber, IsOptional, IsString, Max, MaxLength, Min } from 'class-validator';

/** Hamma maydon ixtiyoriy. title / instructions / timeLimitSec ga null yuborilsa, tozalanadi. */
export class UpdateSectionDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  title?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  instructions?: string | null;

  /** Bo'lim vaqti (sekund) */
  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(36000)
  timeLimitSec?: number | null;

  /** Bo'limning maksimal bali (Multilevelda 75) */
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(75)
  maxScore?: number;
}
