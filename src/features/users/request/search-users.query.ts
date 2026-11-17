import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

/** Query for `GET /users`. */
export class SearchUsersQuery {
  /** Username or display-name fragment. */
  @ApiPropertyOptional({
    description: 'Username or display name fragment (at least 2 characters).',
    example: 'ali',
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  search?: string;

  /** Maximum results. Defaults to 20, capped at 50. */
  @ApiPropertyOptional({
    description: 'Maximum number of results (1–50).',
    default: 20,
    minimum: 1,
    maximum: 50,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}
