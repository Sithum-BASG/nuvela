import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({ example: 'Website Redesign' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ example: 'Q3 marketing site refresh.' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ example: '#6366F1', description: 'Hex or token color.' })
  @IsString()
  @MinLength(1)
  color!: string;
}
