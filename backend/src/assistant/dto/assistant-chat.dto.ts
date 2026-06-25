import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AssistantPageContextDto {
  @ApiPropertyOptional({ description: 'Current frontend route.' })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  route?: string;

  @ApiPropertyOptional({
    description: 'Current project id, when on a project route.',
  })
  @IsOptional()
  @IsUUID('4')
  projectId?: string;

  @ApiPropertyOptional({
    description: 'Current task id, when on a task route.',
  })
  @IsOptional()
  @IsUUID('4')
  taskId?: string;
}

export class AssistantChatDto {
  @ApiProperty({
    description: 'User message for the assistant.',
    minLength: 1,
    maxLength: 2000,
  })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  message: string;

  @ApiPropertyOptional({ type: AssistantPageContextDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AssistantPageContextDto)
  page?: AssistantPageContextDto;
}
