import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  ValidateNested,
} from 'class-validator';

// One task's reassignment decision when removing a member who has assigned
// tasks: a remaining member's id, or null to leave the task unassigned.
export class ReassignmentDto {
  @ApiPropertyOptional({ description: 'The task being reassigned.' })
  @IsUUID()
  taskId!: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'A remaining member to reassign to, or null to unassign.',
  })
  @IsOptional()
  @IsString()
  newAssigneeId!: string | null;
}

export class RemoveMemberDto {
  @ApiPropertyOptional({
    type: [ReassignmentDto],
    description:
      "Per-task reassignment decisions for the removed member's tasks.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReassignmentDto)
  reassignments?: ReassignmentDto[];
}
