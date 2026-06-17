import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddAssigneeDto {
  @ApiProperty({ description: 'User ID to assign to this task' })
  @IsUUID('4')
  userId: string;
}
