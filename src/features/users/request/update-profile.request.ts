import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBase64,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  MinLength,
} from 'class-validator';

/** Body of `PATCH /users/me`. */
export class UpdateProfileRequest {
  @ApiPropertyOptional({
    example: 'Abishek',
    minLength: 2,
    maxLength: 50,
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  displayName?: string;

  /** Direct image URL. Send `null` to remove the current avatar. */
  @ApiPropertyOptional({
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
    maxLength: 2048,
  })
  @IsOptional()
  @IsUrl({ require_protocol: true })
  @MaxLength(2048)
  avatarUrl?: string | null;

  /** Base64 X25519 public key published for end-to-end encryption. */
  @ApiPropertyOptional({ example: 'm5S…', maxLength: 255 })
  @IsOptional()
  @IsString()
  @IsBase64()
  @MaxLength(255)
  publicKey?: string;
}
