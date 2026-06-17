import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class TransferProjectDto {
  @ApiProperty({
    description: 'A PM or Owner in the same organization to transfer to.',
  })
  @IsUUID()
  newManagerId!: string;
}
