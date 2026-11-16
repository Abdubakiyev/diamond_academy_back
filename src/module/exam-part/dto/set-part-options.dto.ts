import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PartOptionInputDto {
  /** A dan J gacha */
  @IsString()
  @Matches(/^[A-J]$/, { message: 'label A dan J gacha bitta harf bo‘lishi kerak' })
  label!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  text!: string;

  /** Rasm manzili (http/https), masalan presign natijasidagi publicUrl */
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  imageUrl?: string;
}

/** Umumiy variantlar banki (A-H): speaker -> statement, paragraph -> heading, xarita belgilari */
export class SetPartOptionsDto {
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => PartOptionInputDto)
  options!: PartOptionInputDto[];
}
