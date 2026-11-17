import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { ConversationParticipantEntity } from '../repository/conversations.entity';

/** Public summary of the other participant in a conversation. */
@Exclude()
export class ConversationParticipantResponse {
  /** Public UUID sourced from `users.public_id`. */
  @ApiProperty({ example: '6d9c1d0e-…' })
  @Expose()
  id: string;

  @ApiProperty({ example: 'abishek' })
  @Expose()
  username: string;

  @ApiProperty({ example: 'Abishek', nullable: true })
  @Expose()
  displayName: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/avatar.png',
    nullable: true,
  })
  @Expose()
  avatarUrl: string | null;

  /** Base64 X25519 public key used for end-to-end encryption. */
  @ApiProperty({ example: 'm5S…', nullable: true })
  @Expose()
  publicKey: string | null;
}

/** Map a public participant entity to its response shape. */
export function toConversationParticipantResponse(
  participant: ConversationParticipantEntity,
): ConversationParticipantResponse {
  return plainToInstance(
    ConversationParticipantResponse,
    {
      id: participant.public_id,
      username: participant.username,
      displayName: participant.display_name,
      avatarUrl: participant.avatar_url,
      publicKey: participant.public_key,
    },
    { excludeExtraneousValues: true },
  );
}
