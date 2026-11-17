import type { HashingService } from '@core/hashing/index';
import type { UserEntity } from '../repository/users.entity';
import type { UsersRepository } from '../repository/users.repository';
import { UserRegisterUsecase } from './user-register.usecase';

// Unit test: replace the DI collaborator (and its ESM-only dependencies)
// with a stub. The usecase only needs it as an injected token/object.
jest.mock('@core/hashing/index', () => ({
  HashingService: class HashingService {},
}));

/** A complete `users` row, used as the persisted fixture. */
const createdUser: UserEntity = {
  id: '1',
  public_id: '11111111-1111-4111-8111-111111111111',
  username: 'abishek',
  email: 'abishek@example.com',
  password_hash: '$2b$10$hashed-password',
  display_name: 'Abishek',
  avatar_url: null,
  public_key: null,
  key_version: 1,
  is_active: true,
  last_seen_at: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UserRegisterUsecase', () => {
  let usecase: UserRegisterUsecase;
  let users: jest.Mocked<UsersRepository>;
  let hashing: jest.Mocked<HashingService>;

  const request = {
    username: 'abishek',
    email: 'abishek@example.com',
    password: 'super-secret-password',
    displayName: 'Abishek',
  };

  beforeEach(() => {
    users = {
      findById: jest.fn(),
      findByEmail: jest.fn(),
      findByUsername: jest.fn(),
      existsByEmail: jest.fn(),
      existsByUsername: jest.fn(),
      create: jest.fn(),
    } as unknown as jest.Mocked<UsersRepository>;

    hashing = {
      hash: jest.fn(),
      verify: jest.fn(),
      genSalt: jest.fn(),
      getRounds: jest.fn(),
    } as unknown as jest.Mocked<HashingService>;

    usecase = new UserRegisterUsecase(users, hashing);
  });

  it('hashes the password, persists the user and returns the public shape', async () => {
    users.existsByEmail.mockResolvedValue(false);
    users.existsByUsername.mockResolvedValue(false);
    hashing.hash.mockResolvedValue(createdUser.password_hash);
    users.create.mockResolvedValue(createdUser);

    const result = await usecase.execute(request);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.user).toMatchObject({
      id: createdUser.public_id,
      username: createdUser.username,
      email: createdUser.email,
      displayName: createdUser.display_name,
      createdAt: createdUser.created_at,
    });
    expect(result.data.user.id).toBe(createdUser.public_id);
    expect(result.data.user.id).not.toBe(createdUser.id);
    expect(result.data.user).not.toHaveProperty('password_hash');

    expect(users.existsByEmail).toHaveBeenCalledWith(request.email);
    expect(users.existsByUsername).toHaveBeenCalledWith(request.username);
    expect(hashing.hash).toHaveBeenCalledWith(request.password);
    expect(users.create).toHaveBeenCalledWith({
      username: request.username,
      email: request.email,
      password_hash: createdUser.password_hash,
      display_name: request.displayName,
    });
  });

  it('stores null when no display name is provided', async () => {
    users.existsByEmail.mockResolvedValue(false);
    users.existsByUsername.mockResolvedValue(false);
    hashing.hash.mockResolvedValue(createdUser.password_hash);
    users.create.mockResolvedValue({ ...createdUser, display_name: null });

    await usecase.execute({
      username: request.username,
      email: request.email,
      password: request.password,
    });

    expect(users.create).toHaveBeenCalledWith(
      expect.objectContaining({ display_name: null }),
    );
  });

  it('fails with EMAIL_ALREADY_EXISTS before touching the username or hashing', async () => {
    users.existsByEmail.mockResolvedValue(true);

    const result = await usecase.execute(request);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error).toEqual({
      statusCode: 'EMAIL_ALREADY_EXISTS',
      error: 'Conflict',
      message: 'That email is already registered',
    });

    expect(users.existsByUsername).not.toHaveBeenCalled();
    expect(hashing.hash).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
  });

  it('fails with USERNAME_ALREADY_EXISTS before hashing or persisting', async () => {
    users.existsByEmail.mockResolvedValue(false);
    users.existsByUsername.mockResolvedValue(true);

    const result = await usecase.execute(request);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error).toEqual({
      statusCode: 'USERNAME_ALREADY_EXISTS',
      error: 'Conflict',
      message: 'That username is taken',
    });

    expect(hashing.hash).not.toHaveBeenCalled();
    expect(users.create).not.toHaveBeenCalled();
  });
});
