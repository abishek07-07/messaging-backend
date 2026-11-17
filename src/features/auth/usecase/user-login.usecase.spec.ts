import type { HashingService } from '@core/hashing/index';
import type { JsonWebTokenService } from '@core/jsonwebtoken/jwt.service';
import type { UserEntity } from '../repository/users.entity';
import type { UsersRepository } from '../repository/users.repository';
import { UserLoginUsecase } from './user-login.usecase';

// Unit test: replace the DI collaborators (and their ESM-only dependencies)
// with stubs. The usecase only needs them as injected tokens/objects.
jest.mock('@core/hashing/index', () => ({
  HashingService: class HashingService {},
}));
jest.mock('@core/jsonwebtoken/jwt.service', () => ({
  JsonWebTokenService: class JsonWebTokenService {},
}));

/** A complete `users` row, used as the happy-path fixture. */
const storedUser: UserEntity = {
  id: '1',
  public_id: '11111111-1111-4111-8111-111111111111',
  username: 'abishek',
  email: 'abishek@example.com',
  password_hash: '$2b$10$stored-hash',
  display_name: 'Abishek',
  avatar_url: null,
  public_key: null,
  key_version: 1,
  is_active: true,
  last_seen_at: null,
  created_at: new Date('2026-01-01T00:00:00.000Z'),
  updated_at: new Date('2026-01-01T00:00:00.000Z'),
};

describe('UserLoginUsecase', () => {
  let usecase: UserLoginUsecase;
  let users: jest.Mocked<UsersRepository>;
  let hashing: jest.Mocked<HashingService>;
  let tokens: jest.Mocked<JsonWebTokenService>;

  const request = {
    email: 'abishek@example.com',
    password: 'super-secret-password',
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

    tokens = {
      signIn: jest.fn(),
      signInWithOptions: jest.fn(),
      verify: jest.fn(),
      decode: jest.fn(),
      decodeWithOptions: jest.fn(),
    } as unknown as jest.Mocked<JsonWebTokenService>;

    usecase = new UserLoginUsecase(users, hashing, tokens);
  });

  it('signs a token and returns the public user when the credentials are valid', async () => {
    users.findByEmail.mockResolvedValue(storedUser);
    hashing.verify.mockResolvedValue(true);
    tokens.signIn.mockReturnValue('signed.jwt.token');

    const result = await usecase.execute(request);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.accessToken).toBe('signed.jwt.token');
    expect(result.data.user).toMatchObject({
      id: storedUser.public_id,
      username: storedUser.username,
      email: storedUser.email,
      displayName: storedUser.display_name,
      createdAt: storedUser.created_at,
    });
    // Sensitive columns must never reach the response.
    expect(result.data.user.id).toBe(storedUser.public_id);
    expect(result.data.user.id).not.toBe(storedUser.id);
    expect(result.data.user).not.toHaveProperty('password_hash');
    expect(result.data.user).not.toHaveProperty('public_key');

    expect(users.findByEmail).toHaveBeenCalledWith(request.email);
    expect(hashing.verify).toHaveBeenCalledWith(
      request.password,
      storedUser.password_hash,
    );
    expect(tokens.signIn).toHaveBeenCalledWith({
      sub: storedUser.public_id,
      username: storedUser.username,
      email: storedUser.email,
    });
  });

  it('fails with INVALID_CREDENTIALS when the email is unknown', async () => {
    users.findByEmail.mockResolvedValue(null);

    const result = await usecase.execute(request);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error).toEqual({
      statusCode: 'INVALID_CREDENTIALS',
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });

    // No password work and no token should happen for an unknown account.
    expect(hashing.verify).not.toHaveBeenCalled();
    expect(tokens.signIn).not.toHaveBeenCalled();
  });

  it('fails with the same INVALID_CREDENTIALS error when the password is wrong', async () => {
    users.findByEmail.mockResolvedValue(storedUser);
    hashing.verify.mockResolvedValue(false);

    const result = await usecase.execute(request);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error).toEqual({
      statusCode: 'INVALID_CREDENTIALS',
      error: 'Unauthorized',
      message: 'Invalid email or password',
    });

    expect(hashing.verify).toHaveBeenCalledWith(
      request.password,
      storedUser.password_hash,
    );
    expect(tokens.signIn).not.toHaveBeenCalled();
  });

  it('does not reveal whether the email exists', async () => {
    users.findByEmail.mockResolvedValueOnce(null);
    const unknownEmail = await usecase.execute(request);

    users.findByEmail.mockResolvedValueOnce(storedUser);
    hashing.verify.mockResolvedValueOnce(false);
    const wrongPassword = await usecase.execute(request);

    expect(unknownEmail).toEqual(wrongPassword);
  });
});
