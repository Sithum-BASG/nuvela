import { PartialType } from '@nestjs/swagger';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { CreateProjectDto } from './create-project.dto';

export class UpdateProjectDto extends PartialType(CreateProjectDto) {
  @ApiPropertyOptional({ example: 'Website Redesign' })
  name?: string;

  @ApiPropertyOptional({ example: 'Q3 marketing site refresh.' })
  description?: string;

  @ApiPropertyOptional({ example: '#6366F1' })
  color?: string;
}
