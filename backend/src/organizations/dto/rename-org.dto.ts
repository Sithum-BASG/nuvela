import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class RenameOrgDto {
  @ApiProperty({ example: 'Nuvela Studio' })
  @IsString()
  @MinLength(1)
  name!: string;
}
