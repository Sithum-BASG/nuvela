import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateChecklistItemDto {
  @ApiPropertyOptional({ description: 'Checklist item text' })
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional({ description: 'Checked state' })
  @IsOptional()
  @IsBoolean()
  isChecked?: boolean;
}
