import { ApiProperty } from '@nestjs/swagger';
import { IsJWT } from 'class-validator';

export class VerifyEmailDto {
  @ApiProperty({ description: 'Email verification JWT from the email link.' })
  @IsJWT()
  token!: string;
}
