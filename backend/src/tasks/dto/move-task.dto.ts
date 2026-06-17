import { ApiProperty } from '@nestjs/swagger';
import { IsInt, IsUUID, Min } from 'class-validator';

export class MoveTaskDto {
  @ApiProperty({ description: 'Target column ID' })
  @IsUUID('4')
  columnId: string;

  @ApiProperty({
    description: 'Target position index within the column (0-based)',
    minimum: 0,
  })
  @IsInt()
  @Min(0)
  position: number;
}
