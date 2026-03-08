import { IsString, IsNotEmpty, IsNumber, IsOptional, IsObject, IsArray, Min, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ProxyConfigDto {
  @IsString()
  type: string;

  @IsString()
  @IsNotEmpty()
  host: string;

  @IsNumber()
  @Min(1)
  port: number;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;
}

export class WorkspaceConfigDto {
  @ValidateNested()
  @Type(() => ProxyConfigDto)
  proxy: ProxyConfigDto;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  userAgents?: string[];
}

export class CreateWorkspaceDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  ownerId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  taskCount?: number;

  @IsOptional()
  @ValidateNested()
  @Type(() => WorkspaceConfigDto)
  config?: WorkspaceConfigDto;
}
