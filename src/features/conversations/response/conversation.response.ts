import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type { ConversationEntity } from '../repository/conversations.entity';
import type { FriendshipWithUserEntity } from '@features/friends/repository/friendships.entity';
import type { LatestMessageEntity } from '@features/messages/repository/messages.entity';
import {
  ConversationParticipantResponse,
  toConversationParticipantResponse,
} from './conversation-participant.response';
import {
  LatestMessageResponse,
  toLatestMessageResponse,
} from './latest-message.response';

/**
 * One row of the chat list: the friend, the direct conversation with them, and
 * the most recent message (or `null` when the conversation is empty).
 */
@Exclude()
export class ConversationResponse {
  /** Public UUID of the conversation. */
  @ApiProperty({ example: '4b1f0f52-…' })
  @Expose()
  id: string;

  /** Accepted friend on the other side of the direct conversation. */
  @ApiProperty({ type: ConversationParticipantResponse })
  @Expose()
  friend: ConversationParticipantResponse;

  @ApiProperty({ type: LatestMessageResponse, nullable: true })
  @Expose()
  latestMessage: LatestMessageResponse | null;

  /** Messages the caller has not read yet. */
  @ApiProperty({ example: 3 })
  @Expose()
  unreadCount: number;
}

/** Map a conversation + friend + newest message to the chat-list row. */
export function toConversationResponse(
  conversation: ConversationEntity,
  friend: FriendshipWithUserEntity,
  latestMessage: LatestMessageEntity | null,
  actorInternalId: string,
  unreadCount: number,
): ConversationResponse {
  return plainToInstance(
    ConversationResponse,
    {
      id: conversation.public_id,
      friend: toConversationParticipantResponse(friend.user),
      latestMessage: latestMessage
        ? toLatestMessageResponse(latestMessage, actorInternalId)
        : null,
      unreadCount,
    },
    { excludeExtraneousValues: true },
  );
}
