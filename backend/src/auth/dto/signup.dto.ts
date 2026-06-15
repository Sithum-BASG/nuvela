import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class SignupDto {
  @ApiProperty({ example: 'Maya Fernando' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'maya@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Str0ngPass!' })
  @IsString()
  @MinLength(8)
  password!: string;

  @ApiProperty({ example: 'Nuvela Studio' })
  @IsString()
  @MinLength(1)
  orgName!: string;
}
