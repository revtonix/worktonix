import { IsEmail, IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { Role } from './create-user.dto';

export class UpdateUserDto {
  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;

  @IsOptional()
  @IsString()
  displayName?: string;

  /**
   * User role — must be one of: ADMIN, TECH, MANAGER, OPERATOR, STAFF.
   */
  @IsOptional()
  @IsEnum(Role)
  role?: Role;
}
