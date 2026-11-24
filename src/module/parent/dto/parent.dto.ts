import { IsIn, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class ParentRegisterDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(9)
  @MaxLength(20)
  phone: string;

  @IsString()
  @MinLength(6)
  @MaxLength(100)
  password: string;
}

export class LinkChildDto {
  @IsUUID()
  studentId: string;
}

export class ReviewLinkDto {
  @IsIn(['APPROVED', 'REJECTED'])
  status: 'APPROVED' | 'REJECTED';
}
