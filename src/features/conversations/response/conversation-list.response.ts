import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import {
  ConversationResponse,
  toConversationResponse,
} from './conversation.response';
import type { ConversationEntity } from '../repository/conversations.entity';
import type { FriendshipWithUserEntity } from '@features/friends/repository/friendships.entity';
import type { LatestMessageEntity } from '@features/messages/repository/messages.entity';

/** Body of `GET /conversations`. */
@Exclude()
export class ConversationListResponse {
  /** One row per accepted friend, most recent activity first. */
  @ApiProperty({ type: [ConversationResponse] })
  @Expose()
  conversations: ConversationResponse[];
}

/** A friend paired with their conversation and newest message. */
export interface ConversationListRow {
  conversation: ConversationEntity;
  friend: FriendshipWithUserEntity;
  latestMessage: LatestMessageEntity | null;
  unreadCount: number;
}

/** Map every friend's chat row to the list response. */
export function toConversationListResponse(
  rows: ConversationListRow[],
  actorInternalId: string,
): ConversationListResponse {
  return plainToInstance(
    ConversationListResponse,
    {
      conversations: rows.map((row) =>
        toConversationResponse(
          row.conversation,
          row.friend,
          row.latestMessage,
          actorInternalId,
          row.unreadCount,
        ),
      ),
    },
    { excludeExtraneousValues: true },
  );
}
