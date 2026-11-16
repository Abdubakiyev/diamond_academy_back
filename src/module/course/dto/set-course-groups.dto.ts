import { ApiProperty } from '@nestjs/swagger';
import { ArrayUnique, IsArray, IsUUID } from 'class-validator';

/** Kursni ko'ra oladigan guruhlar ro'yxati (eskisi to'liq almashtiriladi). Bo'sh massiv = hech kimga. */
export class SetCourseGroupsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    example: ['6a5b4c3d-2e1f-4a0b-9c8d-7e6f5a4b3c2d', 'b7a6c5d4-e3f2-4a1b-8c9d-0e1f2a3b4c5d'],
    description: 'Mavjud guruh ID lari. Bo\'sh massiv = kurs hech kimga ko\'rinmaydi',
  })
  @IsArray()
  @ArrayUnique()
  @IsUUID('all', { each: true })
  groupIds!: string[];
}
