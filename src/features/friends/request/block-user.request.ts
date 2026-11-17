import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

/** Body of `POST /friends/blocked`. */
export class BlockUserRequest {
  @ApiProperty({
    description: 'Public UUID of the user to block.',
    example: '6d9c1d0e-8a5b-4a65-9f6c-0b7e1d2c3a4b',
    format: 'uuid',
  })
  @IsUUID()
  userId: string;
}
