import { BlockUserUsecase } from './block-user.usecase';
import {
  actorUser,
  friendshipsRepositoryMock,
  otherUser,
  userBlock,
  userBlocksRepositoryMock,
  usersRepositoryMock,
} from './friends.fixtures';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UserBlocksRepository } from '../repository/user-blocks.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('BlockUserUsecase', () => {
  let usecase: BlockUserUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;
  let blocks: jest.Mocked<UserBlocksRepository>;

  const command = {
    actorPublicId: actorUser.public_id,
    targetPublicId: otherUser.public_id,
  };

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    blocks = userBlocksRepositoryMock();
    usecase = new BlockUserUsecase(users, friendships, blocks);

    users.findByPublicId
      .mockResolvedValueOnce(actorUser)
      .mockResolvedValueOnce(otherUser);
    blocks.create.mockResolvedValue(userBlock);
    friendships.markBlockedBetween.mockResolvedValue(undefined);
  });

  it('blocks the user and marks any existing friendship as blocked', async () => {
    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data).toMatchObject({
      id: userBlock.public_id,
      user: { id: otherUser.public_id },
      blockedAt: userBlock.created_at,
    });
    expect(blocks.create).toHaveBeenCalledWith({
      blocker_id: actorUser.id,
      blocked_id: otherUser.id,
    });
    expect(friendships.markBlockedBetween).toHaveBeenCalledWith(
      actorUser.id,
      otherUser.id,
    );
  });

  it('refuses to block self', async () => {
    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      targetPublicId: actorUser.public_id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('CANNOT_BLOCK_SELF');
    expect(blocks.create).not.toHaveBeenCalled();
  });

  it('fails when the target does not exist', async () => {
    users.findByPublicId
      .mockReset()
      .mockResolvedValueOnce(actorUser)
      .mockResolvedValueOnce(null);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('USER_NOT_FOUND');
  });
});
