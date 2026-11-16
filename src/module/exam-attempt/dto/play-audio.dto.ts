import { IsOptional, IsUUID } from 'class-validator';

/** Listening audiosini eshittirish so'rovi: partId YOKI questionId (aynan bittasi) */
export class PlayAudioDto {
  @IsOptional()
  @IsUUID()
  partId?: string;

  @IsOptional()
  @IsUUID()
  questionId?: string;
}
