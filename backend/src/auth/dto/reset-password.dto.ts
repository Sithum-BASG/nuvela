import { ApiProperty } from '@nestjs/swagger';
import { IsJWT, IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset JWT from the email link.' })
  @IsJWT()
  token!: string;

  @ApiProperty({ example: 'N3wStr0ngPass!' })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
