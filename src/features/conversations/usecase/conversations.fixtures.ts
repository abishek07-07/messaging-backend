import type { UserEntity } from '@features/auth/repository/users.entity';
import type { UsersRepository } from '@features/auth/repository/users.repository';
import type {
  FriendshipEntity,
  FriendshipWithUserEntity,
} from '@features/friends/repository/friendships.entity';
import type { FriendshipsRepository } from '@features/friends/repository/friendships.repository';
import type {
  LatestMessageEntity,
  MessageEntity,
} from '@features/messages/repository/messages.entity';
import type { ConversationEntity } from '../repository/conversations.entity';
import type { ConversationsRepository } from '../repository/conversations.repository';

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

/** Accepted friend #1. */
export const friendUser: UserEntity = {
  id: '2',
  public_id: '22222222-2222-4222-8222-222222222222',
  username: 'bob',
  email: 'bob@example.com',
  password_hash: '$2b$10$friend-hash',
  display_name: 'Bob',
  avatar_url: 'https://cdn.example.com/bob.png',
  public_key: null,
  key_version: 0,
  is_active: true,
  last_seen_at: null,
  created_at: new Date('2026-01-02T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

/** Accepted friend #2, used for ordering assertions. */
export const secondFriendUser: UserEntity = {
  ...friendUser,
  id: '3',
  public_id: '33333333-3333-4333-8333-333333333333',
  username: 'carol',
  email: 'carol@example.com',
  display_name: 'Carol',
  avatar_url: null,
};

/** Build a complete conversation row, overriding only what a test needs. */
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
    sender_id: friendUser.id,
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

/** Build an accepted-friend view from the caller's perspective. */
export function makeFriendshipView(
  user: UserEntity = friendUser,
  overrides: Partial<FriendshipEntity> = {},
): FriendshipWithUserEntity {
  return {
    friendship: {
      id: '10',
      public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      requester_id: actorUser.id,
      addressee_id: user.id,
      status: 'accepted',
      created_at: new Date('2026-11-01T08:00:00.000Z'),
      updated_at: new Date('2026-11-01T08:00:00.000Z'),
      ...overrides,
    },
    user,
    user_internal_id: user.id,
  };
}

/** Build the newest-message view returned for a conversation. */
export function makeLatestMessage(
  conversationId: string,
  overrides: Partial<MessageEntity> = {},
  sender: LatestMessageEntity['sender'] = {
    public_id: friendUser.public_id,
    username: friendUser.username,
    display_name: friendUser.display_name,
    avatar_url: friendUser.avatar_url,
    public_key: friendUser.public_key,
  },
): LatestMessageEntity {
  return {
    conversation_id: conversationId,
    message: makeMessage({ conversation_id: conversationId, ...overrides }),
    sender,
  };
}

/** Repository doubles used by the chat-list spec. */
export function usersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findById: jest.fn(),
    findByPublicId: jest.fn(),
    findByEmail: jest.fn(),
    findByUsername: jest.fn(),
    existsByEmail: jest.fn(),
    existsByUsername: jest.fn(),
    create: jest.fn(),
  } as unknown as jest.Mocked<UsersRepository>;
}

export function friendshipsRepositoryMock(): jest.Mocked<FriendshipsRepository> {
  return {
    findByPublicId: jest.fn(),
    findBetween: jest.fn(),
    create: jest.fn(),
    updateStatus: jest.fn(),
    reopen: jest.fn(),
    deleteByPublicId: jest.fn(),
    listIncomingRequests: jest.fn(),
    listOutgoingRequests: jest.fn(),
    listFriends: jest.fn(),
    markBlockedBetween: jest.fn(),
    deleteBlockedBetween: jest.fn(),
  } as unknown as jest.Mocked<FriendshipsRepository>;
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
