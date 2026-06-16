import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsUUID, ValidateNested } from 'class-validator';

// One owned project's mandatory transfer target when deactivating a PM.
export class ProjectTransferDto {
  @ApiPropertyOptional({ description: 'A project the PM currently manages.' })
  @IsUUID()
  projectId!: string;

  @ApiPropertyOptional({
    description: 'A PM or Owner to take over the project.',
  })
  @IsUUID()
  newManagerId!: string;
}

export class DeactivateUserDto {
  @ApiPropertyOptional({
    type: [ProjectTransferDto],
    description:
      'Required when deactivating a PM with owned projects: a transfer per project.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProjectTransferDto)
  transfers?: ProjectTransferDto[];
}
