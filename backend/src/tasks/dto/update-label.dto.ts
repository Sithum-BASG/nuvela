import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateLabelDto {
  @ApiPropertyOptional({ description: 'Label name', minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional({ description: 'Label color', minLength: 1 })
  @IsOptional()
  @IsString()
  @MinLength(1)
  color?: string;
}
