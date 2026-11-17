import type { UserEntity } from '@features/auth/repository/users.entity';
import type { UsersRepository } from '@features/auth/repository/users.repository';
import type {
  FriendshipEntity,
  FriendshipWithUserEntity,
} from '../repository/friendships.entity';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UserBlockEntity } from '../repository/user-blocks.entity';
import type { UserBlocksRepository } from '../repository/user-blocks.repository';

/** Complete `users` row used as the authenticated caller. */
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

/** Complete `users` row used as the other participant. */
export const otherUser: UserEntity = {
  id: '2',
  public_id: '22222222-2222-4222-8222-222222222222',
  username: 'bob',
  email: 'bob@example.com',
  password_hash: '$2b$10$other-hash',
  display_name: 'Bob',
  avatar_url: 'https://cdn.example.com/bob.png',
  public_key: null,
  key_version: 0,
  is_active: true,
  last_seen_at: null,
  created_at: new Date('2026-01-02T00:00:00.000Z'),
  updated_at: new Date('2026-01-02T00:00:00.000Z'),
};

/** Build a complete friendship row, overriding only what a test needs. */
export function makeFriendship(
  overrides: Partial<FriendshipEntity> = {},
): FriendshipEntity {
  return {
    id: '10',
    public_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    requester_id: actorUser.id,
    addressee_id: otherUser.id,
    user_low_id: actorUser.id,
    user_high_id: otherUser.id,
    status: 'pending',
    created_at: new Date('2026-11-01T10:00:00.000Z'),
    updated_at: new Date('2026-11-01T10:00:00.000Z'),
    ...overrides,
  };
}

/** Build a friendship + other-user view used by response mappers. */
export function makeFriendshipView(
  friendship: FriendshipEntity = makeFriendship(),
  user: UserEntity = otherUser,
): FriendshipWithUserEntity {
  return { friendship, user, user_internal_id: user.id };
}

/** A block created by the actor against the other user. */
export const userBlock: UserBlockEntity = {
  public_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  blocker_id: actorUser.id,
  blocked_id: otherUser.id,
  created_at: new Date('2026-11-02T10:00:00.000Z'),
};

/** Repository doubles used by the usecase specs. */
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

export function userBlocksRepositoryMock(): jest.Mocked<UserBlocksRepository> {
  return {
    findByPair: jest.fn(),
    existsBetween: jest.fn(),
    create: jest.fn(),
    deleteByPair: jest.fn(),
    listBlocked: jest.fn(),
  } as unknown as jest.Mocked<UserBlocksRepository>;
}
