import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Priority } from '@prisma/client';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MinLength,
} from 'class-validator';

export class ConfirmCreateTaskDto {
  @ApiProperty({ description: 'Project id where the task should be created.' })
  @IsUUID('4')
  projectId: string;

  @ApiProperty({ description: 'Task title.', minLength: 1 })
  @IsString()
  @MinLength(1)
  title: string;

  @ApiPropertyOptional({ description: 'Task description.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: Priority })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ description: 'Due date as ISO 8601.' })
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional({
    type: [String],
    description: 'Initial assignee user ids.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  assigneeIds?: string[];
}
