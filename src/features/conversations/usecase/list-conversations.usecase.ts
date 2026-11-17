import { Injectable } from '@nestjs/common';
import { UsersRepository } from '@features/auth/repository/users.repository';
import { FriendshipsRepository } from '@features/friends/repository/friendships.repository';
import { failure, success, Usecase, Response } from '@utils/usecase/index';
import { ConversationsRepository } from '../repository/conversations.repository';
import {
  ConversationListResponse,
  ConversationListRow,
  toConversationListResponse,
} from '../response/conversation-list.response';

/** Input for listing the caller's chat list. */
export interface ListConversationsCommand {
  /** Public UUID of the authenticated caller. */
  actorPublicId: string;
}

/**
 * Chat list: one row per accepted friend.
 *
 * Every row is guaranteed a conversation. A direct conversation is created on
 * demand when the two users do not have one yet, so the client can always
 * navigate to `GET /conversations/:conversationId/messages`. Rows are sorted by
 * the newest message (empty conversations last).
 */
@Injectable()
export class ListConversationsUsecase implements Usecase<
  ListConversationsCommand,
  ConversationListResponse
> {
  constructor(
    private readonly users: UsersRepository,
    private readonly friendships: FriendshipsRepository,
    private readonly conversations: ConversationsRepository,
  ) {}

  async execute(
    command: ListConversationsCommand,
  ): Promise<Response<ConversationListResponse>> {
    const actor = await this.users.findByPublicId(command.actorPublicId);
    if (!actor || !actor.is_active) {
      return failure<ConversationListResponse>(
        'UNAUTHORIZED',
        'Unauthorized',
        'Your account could not be found',
      );
    }

    const friends = await this.friendships.listFriends(actor.id);

    const conversations = await Promise.all(
      friends.map((friend) =>
        this.conversations.findOrCreateDirect(
          actor.id,
          friend.user_internal_id,
        ),
      ),
    );

    const conversationIds = conversations.map(
      (conversation) => conversation.id,
    );

    const [latestMessages, unreadCounts] = await Promise.all([
      this.conversations.listLatestMessages(conversationIds),
      this.conversations.listUnreadCounts(conversationIds, actor.id),
    ]);

    const latestByConversation = new Map(
      latestMessages.map((latest) => [String(latest.conversation_id), latest]),
    );

    const rows: ConversationListRow[] = friends.map((friend, index) => ({
      conversation: conversations[index],
      friend,
      latestMessage:
        latestByConversation.get(String(conversations[index].id)) ?? null,
      unreadCount: unreadCounts.get(String(conversations[index].id)) ?? 0,
    }));

    rows.sort((a, b) => {
      const aTime = a.latestMessage?.message.created_at.getTime() ?? 0;
      const bTime = b.latestMessage?.message.created_at.getTime() ?? 0;

      if (aTime !== bTime) {
        return bTime - aTime;
      }

      return a.friend.user.username.localeCompare(b.friend.user.username);
    });

    return success(toConversationListResponse(rows, actor.id));
  }
}
