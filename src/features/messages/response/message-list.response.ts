import { ApiProperty } from '@nestjs/swagger';
import { Exclude, Expose, plainToInstance } from 'class-transformer';
import type {
  ConversationEntity,
  ConversationParticipantEntity,
  ConversationType,
} from '@features/conversations/repository/conversations.entity';
import type { MessagePageEntity } from '../repository/messages.entity';
import {
  MessageResponse,
  MessageSenderResponse,
  toMessageResponse,
  toMessageSenderResponse,
} from './message.response';

/** Identity and display fields of the conversation being read. */
@Exclude()
export class ConversationSummaryResponse {
  /** Public UUID of the conversation. */
  @ApiProperty({ example: '4b1f0f52-…' })
  @Expose()
  id: string;

  @ApiProperty({ enum: ['direct', 'group'], example: 'direct' })
  @Expose()
  type: ConversationType;

  @ApiProperty({ example: 'Weekend plans', nullable: true })
  @Expose()
  title: string | null;

  @ApiProperty({
    example: 'https://cdn.example.com/group.png',
    nullable: true,
  })
  @Expose()
  avatarUrl: string | null;
}

/** Body of `GET /conversations/:conversationId/messages`. */
@Exclude()
export class MessageListResponse {
  @ApiProperty({ type: ConversationSummaryResponse })
  @Expose()
  conversation: ConversationSummaryResponse;

  /**
   * The other participant in a direct conversation. `null` for groups, where
   * the conversation title/avatar identify the chat instead.
   */
  @ApiProperty({ type: MessageSenderResponse, nullable: true })
  @Expose()
  otherParticipant: MessageSenderResponse | null;

  /** Messages in reading order (oldest → newest). */
  @ApiProperty({ type: [MessageResponse] })
  @Expose()
  messages: MessageResponse[];

  /**
   * Public UUID of the oldest message in this page, to pass as `cursor` when
   * loading older messages. `null` when there are no older messages.
   */
  @ApiProperty({ example: '8f2c8e14-…', nullable: true })
  @Expose()
  nextCursor: string | null;

  /** Whether older messages exist beyond this page. */
  @ApiProperty({ example: true })
  @Expose()
  hasMore: boolean;
}

/** Map a conversation row to its summary shape. */
function toConversationSummaryResponse(
  conversation: ConversationEntity,
): ConversationSummaryResponse {
  return plainToInstance(
    ConversationSummaryResponse,
    {
      id: conversation.public_id,
      type: conversation.type,
      title: conversation.title,
      avatarUrl: conversation.avatar_url,
    },
    { excludeExtraneousValues: true },
  );
}

/** Map the conversation, peer, and one message page to the response body. */
export function toMessageListResponse(
  conversation: ConversationEntity,
  otherParticipant: ConversationParticipantEntity | null,
  page: MessagePageEntity,
  actorInternalId: string,
  nextCursor: string | null,
): MessageListResponse {
  return plainToInstance(
    MessageListResponse,
    {
      conversation: toConversationSummaryResponse(conversation),
      otherParticipant: otherParticipant
        ? toMessageSenderResponse(otherParticipant)
        : null,
      messages: page.messages.map((view) =>
        toMessageResponse(view, actorInternalId),
      ),
      nextCursor,
      hasMore: page.hasMore,
    },
    { excludeExtraneousValues: true },
  );
}
