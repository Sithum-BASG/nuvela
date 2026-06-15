import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class FirstLoginResetPasswordDto {
  @ApiProperty({ example: 'N3wStr0ngPass!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
