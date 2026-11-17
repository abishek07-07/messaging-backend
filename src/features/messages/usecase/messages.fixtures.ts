import type { UserEntity } from '@features/auth/repository/users.entity';
import type { UsersRepository } from '@features/auth/repository/users.repository';
import type { ConversationEntity } from '@features/conversations/repository/conversations.entity';
import type { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import type {
  MessageEntity,
  MessagePageEntity,
  MessageSenderEntity,
  MessageWithSenderEntity,
} from '../repository/messages.entity';
import type { MessagesRepository } from '../repository/messages.repository';

/** The authenticated caller. */
export const actorUser: UserEntity = {
  id: '1',
  public_id: '11111111-1111-4111-8111-111111111111',
  username: 'alice',
  email: 'alice@example.com',
  password_hash: '$2b$10$actor-hash',
  display_name: 'Alice',
  avatar_url: null,
  public_key: null,
  key_version: 0,
  is_active: true,
  last_seen_at: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

/** The other side of the direct conversation. */
export const peerUser: UserEntity = {
  id: '2',
  public_id: '22222222-2222-4222-8222-222222222222',
  username: 'bob',
  email: 'bob@example.com',
  password_hash: '$2b$10$peer-hash',
  display_name: 'Bob',
  avatar_url: 'https://cdn.example.com/bob.png',
  public_key: null,
  key_version: 0,
  is_active: true,
  last_seen_at: null,
  created_at: new Date('2026-01-02T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

/** Public sender shape used by message views. */
export const peerSender: MessageSenderEntity = {
  public_id: peerUser.public_id,
  username: peerUser.username,
  display_name: peerUser.display_name,
  avatar_url: peerUser.avatar_url,
  public_key: peerUser.public_key,
};

/** Direct conversation shared by the two users. */
export function makeConversation(
  overrides: Partial<ConversationEntity> = {},
): ConversationEntity {
  return {
    id: '20',
    public_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    type: 'direct',
    title: null,
    avatar_url: null,
    created_by: actorUser.id,
    created_at: new Date('2026-11-01T09:00:00.000Z'),
    updated_at: new Date('2026-11-01T09:00:00.000Z'),
    ...overrides,
  };
}

/** Build a complete message row, overriding only what a test needs. */
export function makeMessage(
  overrides: Partial<MessageEntity> = {},
): MessageEntity {
  return {
    id: '30',
    public_id: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
    conversation_id: makeConversation().id,
    sender_id: peerUser.id,
    client_message_id: null,
    type: 'text',
    content: 'hello',
    encoding: 'plaintext',
    crypto_metadata: null,
    reply_to_id: null,
    deleted_at: null,
    edited_at: null,
    created_at: new Date('2026-11-05T10:00:00.000Z'),
    ...overrides,
  };
}

/** Pair a message with its sender view. */
export function makeMessageView(
  message: MessageEntity = makeMessage(),
  sender: MessageSenderEntity | null = peerSender,
): MessageWithSenderEntity {
  return { message, sender };
}

/** Build a repository page (already oldest → newest). */
export function makePage(
  messages: MessageWithSenderEntity[],
  hasMore = false,
): MessagePageEntity {
  return { messages, hasMore };
}

/** Repository doubles used by the message-read spec. */
export function usersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    findByPublicId: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    existsByEmail: jest.fn(),
    existsByUsername: jest.fn(),
    create: jest.fn(),
    search: jest.fn(),
    updateProfile: jest.fn(),
  } as unknown as jest.Mocked<UsersRepository>;
}

export function conversationsRepositoryMock(): jest.Mocked<ConversationsRepository> {
  return {
    findByPublicId: jest.fn(),
    findDirectBetween: jest.fn(),
    findOrCreateDirect: jest.fn(),
    isMember: jest.fn(),
    findOtherParticipant: jest.fn(),
    findOtherParticipantInternalId: jest.fn(),
    listLatestMessages: jest.fn(),
    listUnreadCounts: jest.fn(),
  } as unknown as jest.Mocked<ConversationsRepository>;
}

export function messagesRepositoryMock(): jest.Mocked<MessagesRepository> {
  return {
    listByConversation: jest.fn(),
    findByPublicIdInConversation: jest.fn(),
    findByPublicId: jest.fn(),
    findBySenderAndClientId: jest.fn(),
    create: jest.fn(),
    updateContent: jest.fn(),
    softDelete: jest.fn(),
    findViewById: jest.fn(),
    listReplyTargets: jest.fn(),
    findLatestByConversation: jest.fn(),
    markRead: jest.fn(),
    countUnread: jest.fn(),
  } as unknown as jest.Mocked<MessagesRepository>;
}

/** Block-repository double used by send-message tests. */
export function userBlocksRepositoryMock() {
  return {
    existsBetween: jest.fn(),
  } as unknown as jest.Mocked<
    import('@features/friends/repository/user-blocks.repository').UserBlocksRepository
  >;
}
