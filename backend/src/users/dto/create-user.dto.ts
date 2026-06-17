import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { IsEmail, IsEnum, IsString, MinLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'Maya Fernando' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ example: 'maya@example.com' })
  @IsEmail()
  email!: string;

  @ApiProperty({
    enum: Role,
    example: Role.PROJECT_MANAGER,
  })
  @IsEnum(Role)
  role!: Role;
}
