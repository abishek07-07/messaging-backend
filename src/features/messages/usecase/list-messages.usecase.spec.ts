import { ListMessagesUsecase } from './list-messages.usecase';
import {
  actorUser,
  conversationsRepositoryMock,
  makeConversation,
  makeMessage,
  makeMessageView,
  makePage,
  messagesRepositoryMock,
  peerUser,
  usersRepositoryMock,
} from './messages.fixtures';
import type { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import type { MessagesRepository } from '../repository/messages.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('ListMessagesUsecase', () => {
  let usecase: ListMessagesUsecase;
  let users: jest.Mocked<UsersRepository>;
  let conversations: jest.Mocked<ConversationsRepository>;
  let messages: jest.Mocked<MessagesRepository>;

  const conversation = makeConversation();
  const command = {
    actorPublicId: actorUser.public_id,
    conversationPublicId: conversation.public_id,
  };

  beforeEach(() => {
    users = usersRepositoryMock();
    conversations = conversationsRepositoryMock();
    messages = messagesRepositoryMock();
    usecase = new ListMessagesUsecase(users, conversations, messages);

    users.findByPublicId.mockResolvedValue(actorUser);
    conversations.findByPublicId.mockResolvedValue(conversation);
    conversations.isMember.mockResolvedValue(true);
    conversations.findOtherParticipant.mockResolvedValue({
      public_id: peerUser.public_id,
      username: peerUser.username,
      display_name: peerUser.display_name,
      avatar_url: peerUser.avatar_url,
    });
    messages.findByPublicIdInConversation.mockResolvedValue(null);
  });

  it('returns the newest page oldest → newest with the peer profile', async () => {
    const older = makeMessage({
      id: '30',
      public_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      sender_id: peerUser.id,
      content: 'first',
      created_at: new Date('2026-11-05T10:00:00.000Z'),
    });
    const newer = makeMessage({
      id: '31',
      public_id: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      sender_id: actorUser.id,
      content: 'second',
      created_at: new Date('2026-11-05T11:00:00.000Z'),
    });

    messages.listByConversation.mockResolvedValue(
      makePage(
        [
          makeMessageView(older),
          makeMessageView(newer, {
            public_id: actorUser.public_id,
            username: actorUser.username,
            display_name: actorUser.display_name,
            avatar_url: actorUser.avatar_url,
          }),
        ],
        true,
      ),
    );

    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.conversation).toMatchObject({
      id: conversation.public_id,
      type: 'direct',
    });
    expect(result.data.otherParticipant).toMatchObject({
      id: peerUser.public_id,
      username: peerUser.username,
      displayName: peerUser.display_name,
      avatarUrl: peerUser.avatar_url,
    });
    expect(result.data.messages.map((message) => message.content)).toEqual([
      'first',
      'second',
    ]);
    expect(result.data.messages.map((message) => message.isMine)).toEqual([
      false,
      true,
    ]);
    expect(result.data.messages[0].sender).toMatchObject({
      id: peerUser.public_id,
    });
    expect(result.data.hasMore).toBe(true);
    expect(result.data.nextCursor).toBe(older.public_id);
    expect(messages.listByConversation).toHaveBeenCalledWith(
      conversation.id,
      10,
      undefined,
    );
    expect(conversations.findOtherParticipant).toHaveBeenCalledWith(
      conversation.id,
      actorUser.id,
    );
  });

  it('passes the cursor message to the repository for the next older page', async () => {
    const cursorMessage = makeMessage({
      id: '30',
      public_id: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
      created_at: new Date('2026-11-05T10:00:00.000Z'),
    });

    messages.findByPublicIdInConversation.mockResolvedValue(cursorMessage);
    messages.listByConversation.mockResolvedValue(makePage([], false));

    const result = await usecase.execute({
      ...command,
      cursor: cursorMessage.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(messages.findByPublicIdInConversation).toHaveBeenCalledWith(
      cursorMessage.public_id,
      conversation.id,
    );
    expect(messages.listByConversation).toHaveBeenCalledWith(
      conversation.id,
      10,
      { created_at: cursorMessage.created_at, id: cursorMessage.id },
    );
    expect(result.data.messages).toEqual([]);
    expect(result.data.hasMore).toBe(false);
    expect(result.data.nextCursor).toBeNull();
  });

  it('honours a custom page size', async () => {
    messages.listByConversation.mockResolvedValue(makePage([], false));

    await usecase.execute({ ...command, limit: 25 });

    expect(messages.listByConversation).toHaveBeenCalledWith(
      conversation.id,
      25,
      undefined,
    );
  });

  it('rejects a cursor that is not part of the conversation', async () => {
    messages.findByPublicIdInConversation.mockResolvedValue(null);

    const result = await usecase.execute({
      ...command,
      cursor: 'ffffffff-ffff-4fff-8fff-ffffffffffff',
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('INVALID_CURSOR');
    expect(messages.listByConversation).not.toHaveBeenCalled();
  });

  it('fails when the conversation does not exist', async () => {
    conversations.findByPublicId.mockResolvedValue(null);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('CONVERSATION_NOT_FOUND');
    expect(messages.listByConversation).not.toHaveBeenCalled();
  });

  it('hides conversations the caller is not a member of behind the same 404', async () => {
    conversations.isMember.mockResolvedValue(false);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('CONVERSATION_NOT_FOUND');
    expect(messages.listByConversation).not.toHaveBeenCalled();
  });

  it('fails when the authenticated account no longer exists', async () => {
    users.findByPublicId.mockResolvedValue(null);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('UNAUTHORIZED');
    expect(conversations.findByPublicId).not.toHaveBeenCalled();
  });
});
