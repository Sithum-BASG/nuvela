import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddAdminDto {
  @ApiProperty({ example: '00000000-0000-4000-8000-000000000001' })
  @IsUUID()
  userId!: string;
}
