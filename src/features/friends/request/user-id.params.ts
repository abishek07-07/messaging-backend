import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Route params carrying a user's public UUID. */
export class UserIdParams {
  @ApiProperty({
    description: 'Public UUID of the user.',
    format: 'uuid',
  })
  @IsUUID()
  userId: string;
}
