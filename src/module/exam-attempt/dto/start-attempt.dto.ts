import { IsUUID } from 'class-validator';

export class StartAttemptDto {
  @IsUUID()
  examId!: string;
}
