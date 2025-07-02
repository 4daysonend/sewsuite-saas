import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Exclude, Expose, Transform } from 'class-transformer';
import { UserRole } from '../entities/user.entity';

/**
 * DTO for user responses to ensure consistent API format without exposing sensitive data
 * This uses class-transformer to handle field exposure and transformation
 */
@Exclude()
export class UserResponseDto {
  @Expose()
  @ApiProperty({
    description: 'Unique identifier for user',
    example: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
  })
  id: string;

  @Expose()
  @ApiProperty({
    description: 'User email address',
    example: 'user@example.com',
  })
  email: string;

  @Expose()
  @ApiPropertyOptional({ description: 'User first name', example: 'John' })
  firstName?: string;

  @Expose()
  @ApiPropertyOptional({ description: 'User last name', example: 'Doe' })
  lastName?: string;

  @Expose()
  @ApiProperty({
    description: 'User role in the system',
    enum: UserRole,
    example: 'user',
  })
  role: UserRole;

  @Expose()
  @ApiProperty({
    description: 'Whether the user account is active',
    example: true,
  })
  isActive: boolean;

  @Expose()
  @ApiProperty({
    description: 'ISO timestamp of when the user was created',
    example: '2023-01-01T00:00:00.000Z',
  })
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  createdAt: Date | string;

  @Expose()
  @ApiPropertyOptional({
    description: "ISO timestamp of user's last login",
    example: '2023-01-02T00:00:00.000Z',
  })
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  lastLoginAt?: Date | string;

  @Expose()
  @ApiPropertyOptional({
    description: 'ISO timestamp of when user data was last updated',
    example: '2023-01-03T00:00:00.000Z',
  })
  @Transform(({ value }) =>
    value instanceof Date ? value.toISOString() : value,
  )
  updatedAt?: Date | string;

  @Expose()
  @ApiPropertyOptional({
    description: 'Google ID for OAuth login',
    example: '117174902745731403382',
  })
  googleId?: string;

  @Expose()
  @ApiProperty({
    description: "Whether the user's email is verified",
    example: true,
  })
  emailVerified: boolean;

  @Expose()
  @ApiPropertyOptional({
    description: "User's full name (computed property)",
    example: 'John Doe',
  })
  @Transform(({ obj }) => {
    if (obj.firstName && obj.lastName) {
      return `${obj.firstName} ${obj.lastName}`.trim();
    }
    return obj.firstName || obj.lastName || '';
  })
  fullName?: string;

  /**
   * Static method to transform User entities to UserResponseDto
   * This provides a consistent interface for converting entities to DTOs
   */
  static fromEntity(user: any): UserResponseDto {
    const responseDto = new UserResponseDto();
    Object.assign(responseDto, user);
    return responseDto;
  }

  /**
   * Static method to transform an array of User entities to UserResponseDto array
   */
  static fromEntities(users: any[]): UserResponseDto[] {
    return users.map((user) => UserResponseDto.fromEntity(user));
  }
}
