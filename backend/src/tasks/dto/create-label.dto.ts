import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class CreateLabelDto {
  @ApiProperty({ description: 'Label name', minLength: 1 })
  @IsString()
  @MinLength(1)
  name: string;

  @ApiProperty({ description: 'Label color (hex or CSS string)', minLength: 1 })
  @IsString()
  @MinLength(1)
  color: string;
}
