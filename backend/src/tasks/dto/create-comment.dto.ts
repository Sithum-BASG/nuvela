import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateCommentDto {
  @ApiProperty({ description: 'Comment body', minLength: 1, maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  body: string;

  @ApiPropertyOptional({
    description: 'User IDs mentioned in this comment (from the client picker)',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  mentionedUserIds?: string[];
}
