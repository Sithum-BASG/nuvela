import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class ApplyLabelDto {
  @ApiProperty({ description: 'Label ID to apply to the task' })
  @IsUUID('4')
  labelId: string;
}
