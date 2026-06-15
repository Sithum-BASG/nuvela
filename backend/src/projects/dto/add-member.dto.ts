import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class AddMemberDto {
  @ApiProperty({
    description: 'An existing org user to invite to the project.',
  })
  @IsUUID()
  userId!: string;
}
