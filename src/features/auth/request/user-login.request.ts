import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString } from 'class-validator';

/** Body of `POST /auth/login`. */
export class UserLoginRequest {
  @ApiProperty({ example: 'abishek@example.com' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'super-secret-password' })
  @IsString()
  password: string;
}
