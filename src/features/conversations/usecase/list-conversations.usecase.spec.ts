import { ListConversationsUsecase } from './list-conversations.usecase';
import {
  actorUser,
  conversationsRepositoryMock,
  friendUser,
  friendshipsRepositoryMock,
  makeConversation,
  makeFriendshipView,
  makeLatestMessage,
  secondFriendUser,
  usersRepositoryMock,
} from './conversations.fixtures';
import type { ConversationsRepository } from '../repository/conversations.repository';
import type { FriendshipsRepository } from '@features/friends/repository/friendships.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('ListConversationsUsecase', () => {
  let usecase: ListConversationsUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;
  let conversations: jest.Mocked<ConversationsRepository>;

  const command = { actorPublicId: actorUser.public_id };

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    conversations = conversationsRepositoryMock();
    usecase = new ListConversationsUsecase(users, friendships, conversations);

    users.findByPublicId.mockResolvedValue(actorUser);
    conversations.listUnreadCounts.mockResolvedValue(new Map());
  });

  it('returns one row per friend with their conversation and latest message', async () => {
    const conversation = makeConversation();
    const latest = makeLatestMessage(conversation.id, {
      sender_id: friendUser.id,
      content: 'See you at 7?',
    });

    friendships.listFriends.mockResolvedValue([makeFriendshipView(friendUser)]);
    conversations.findOrCreateDirect.mockResolvedValue(conversation);
    conversations.listLatestMessages.mockResolvedValue([latest]);
    conversations.listUnreadCounts.mockResolvedValue(
      new Map([[conversation.id, 2]]),
    );

    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.conversations).toHaveLength(1);
    expect(result.data.conversations[0]).toMatchObject({
      id: conversation.public_id,
      friend: {
        id: friendUser.public_id,
        username: friendUser.username,
        displayName: friendUser.display_name,
        avatarUrl: friendUser.avatar_url,
      },
      latestMessage: {
        id: latest.message.public_id,
        senderId: friendUser.public_id,
        isMine: false,
        content: 'See you at 7?',
        type: 'text',
        createdAt: latest.message.created_at,
      },
      unreadCount: 2,
    });
    expect(conversations.findOrCreateDirect).toHaveBeenCalledWith(
      actorUser.id,
      friendUser.id,
    );
    expect(conversations.listLatestMessages).toHaveBeenCalledWith([
      conversation.id,
    ]);
  });

  it('returns a null latestMessage for an empty conversation', async () => {
    const conversation = makeConversation();

    friendships.listFriends.mockResolvedValue([makeFriendshipView(friendUser)]);
    conversations.findOrCreateDirect.mockResolvedValue(conversation);
    conversations.listLatestMessages.mockResolvedValue([]);

    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }
    expect(result.data.conversations[0].latestMessage).toBeNull();
  });

  it('sorts conversations by newest activity first', async () => {
    const bobConversation = makeConversation({
      id: '20',
      public_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    const carolConversation = makeConversation({
      id: '21',
      public_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
    });

    friendships.listFriends.mockResolvedValue([
      makeFriendshipView(friendUser),
      makeFriendshipView(secondFriendUser),
    ]);
    conversations.findOrCreateDirect
      .mockResolvedValueOnce(bobConversation)
      .mockResolvedValueOnce(carolConversation);
    conversations.listLatestMessages.mockResolvedValue([
      makeLatestMessage(bobConversation.id, {
        created_at: new Date('2026-11-04T10:00:00.000Z'),
      }),
      makeLatestMessage(
        carolConversation.id,
        { created_at: new Date('2026-11-05T10:00:00.000Z') },
        {
          public_id: secondFriendUser.public_id,
          username: secondFriendUser.username,
          display_name: secondFriendUser.display_name,
          avatar_url: secondFriendUser.avatar_url,
        },
      ),
    ]);

    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.conversations.map((row) => row.friend.username)).toEqual(
      [secondFriendUser.username, friendUser.username],
    );
  });

  it('fails when the authenticated account no longer exists', async () => {
    users.findByPublicId.mockResolvedValue(null);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('UNAUTHORIZED');
    expect(friendships.listFriends).not.toHaveBeenCalled();
  });
});
