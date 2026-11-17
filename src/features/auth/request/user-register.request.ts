import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Body of `POST /auth/register`. */
export class UserRegisterRequest {
  @ApiProperty({
    example: 'abishek',
    minLength: 3,
    maxLength: 30,
    description: 'Unique handle; letters, numbers and underscores only.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(30)
  @Matches(/^[a-zA-Z0-9_]+$/, {
    message: 'username may only contain letters, numbers and underscores',
  })
  username: string;

  @ApiProperty({ example: 'abishek@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'super-secret-password',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password: string;

  @ApiProperty({
    example: 'Abishek',
    required: false,
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string;
}
