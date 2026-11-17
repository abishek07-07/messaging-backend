import { GetUserUsecase } from './get-user.usecase';
import type { UserEntity } from '@features/auth/repository/users.entity';
import type { UsersRepository } from '@features/auth/repository/users.repository';

const actor: UserEntity = {
  id: '1',
  public_id: '11111111-1111-4111-8111-111111111111',
  username: 'alice',
  email: 'alice@example.com',
  password_hash: 'hash',
  display_name: 'Alice',
  avatar_url: null,
  public_key: null,
  key_version: 0,
  is_active: true,
  last_seen_at: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

const other: UserEntity = {
  ...actor,
  id: '2',
  public_id: '22222222-2222-4222-8222-222222222222',
  username: 'bob',
  email: 'bob@example.com',
  display_name: 'Bob',
  avatar_url: 'https://cdn.example.com/bob.png',
};

function usersRepositoryMock(): jest.Mocked<UsersRepository> {
  return {
    findByPublicId: jest.fn(),
  } as unknown as jest.Mocked<UsersRepository>;
}

describe('GetUserUsecase', () => {
  let usecase: GetUserUsecase;
  let users: jest.Mocked<UsersRepository>;

  beforeEach(() => {
    users = usersRepositoryMock();
    usecase = new GetUserUsecase(users);
    users.findByPublicId
      .mockResolvedValueOnce(actor)
      .mockResolvedValueOnce(other);
  });

  it('returns another user without their email', async () => {
    const result = await usecase.execute({
      actorPublicId: actor.public_id,
      targetPublicId: other.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data).toMatchObject({
      id: other.public_id,
      username: other.username,
      displayName: other.display_name,
      avatarUrl: other.avatar_url,
      email: null,
    });
  });

  it('returns the caller’s own email', async () => {
    users.findByPublicId.mockReset().mockResolvedValue(actor);

    const result = await usecase.execute({
      actorPublicId: actor.public_id,
      targetPublicId: actor.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }
    expect(result.data.email).toBe(actor.email);
  });

  it('fails when the target does not exist', async () => {
    users.findByPublicId
      .mockReset()
      .mockResolvedValueOnce(actor)
      .mockResolvedValueOnce(null);

    const result = await usecase.execute({
      actorPublicId: actor.public_id,
      targetPublicId: other.public_id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('USER_NOT_FOUND');
  });
});
