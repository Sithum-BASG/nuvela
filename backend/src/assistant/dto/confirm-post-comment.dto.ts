import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class ConfirmPostCommentDto {
  @ApiProperty({ description: 'Task id where the comment should be posted.' })
  @IsUUID('4')
  taskId: string;

  @ApiProperty({ description: 'Comment body.', minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Mentioned project member user ids.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentionedUserIds?: string[];
}
