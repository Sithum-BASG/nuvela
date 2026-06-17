import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateChecklistItemDto {
  @ApiProperty({ description: 'Checklist item text', minLength: 1 })
  @IsString()
  @MinLength(1)
  text: string;
}
