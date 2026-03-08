import { IsString, IsOptional, IsNumber, IsArray, IsEnum, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class StaffTaskAssignmentDto {
  @IsString()
  userId: string;

  @IsNumber()
  @Min(0)
  taskCount: number;

  @IsNumber()
  @Min(0)
  uaStart: number;

  @IsNumber()
  @Min(0)
  uaEnd: number;
}

export enum WorkspaceStatus {
  idle = 'idle',
  running = 'running',
  stopped = 'stopped',
  error = 'error',
}

export class UpdateWorkspaceDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taskCount?: number;

  @IsOptional()
  @IsString()
  profileId?: string;

  @IsOptional()
  @IsEnum(WorkspaceStatus)
  status?: WorkspaceStatus;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StaffTaskAssignmentDto)
  staffTaskAssignments?: StaffTaskAssignmentDto[];

  @IsOptional()
  @IsString()
  error?: string;
}
