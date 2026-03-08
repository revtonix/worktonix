import { IsEmail, IsEnum, IsNotEmpty, IsString, MinLength } from 'class-validator';

/**
 * Roles available in the system.
 * Mirrors the Prisma `Role` enum defined in prisma/schema.prisma.
 */
export enum Role {
  ADMIN = 'ADMIN',
  TECH = 'TECH',
  MANAGER = 'MANAGER',
  OPERATOR = 'OPERATOR',
  STAFF = 'STAFF',
}

export class CreateUserDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @IsString()
  @IsNotEmpty()
  displayName: string;

  /**
   * User role — must be one of: ADMIN, TECH, MANAGER, OPERATOR, STAFF.
   */
  @IsEnum(Role, {
    message: 'role must be one of: ADMIN, TECH, MANAGER, OPERATOR, STAFF',
  })
  role: Role;
}
