import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class UpdateAccountDto {
  @ApiProperty({ example: 'Maya Fernando' })
  @IsString()
  @MinLength(1)
  name!: string;
}
