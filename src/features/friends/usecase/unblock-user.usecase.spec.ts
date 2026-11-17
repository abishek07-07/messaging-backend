import { UnblockUserUsecase } from './unblock-user.usecase';
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

describe('UnblockUserUsecase', () => {
  let usecase: UnblockUserUsecase;
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
    usecase = new UnblockUserUsecase(users, friendships, blocks);

    users.findByPublicId
      .mockResolvedValueOnce(actorUser)
      .mockResolvedValueOnce(otherUser);
    blocks.findByPair.mockResolvedValue(userBlock);
    blocks.deleteByPair.mockResolvedValue(1);
    friendships.deleteBlockedBetween.mockResolvedValue(undefined);
  });

  it('removes the block and any blocked friendship row', async () => {
    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data).toMatchObject({
      id: userBlock.public_id,
      user: { id: otherUser.public_id },
    });
    expect(blocks.deleteByPair).toHaveBeenCalledWith(
      actorUser.id,
      otherUser.id,
    );
    expect(friendships.deleteBlockedBetween).toHaveBeenCalledWith(
      actorUser.id,
      otherUser.id,
    );
  });

  it('fails when the caller has not blocked the user', async () => {
    blocks.findByPair.mockResolvedValue(null);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('BLOCK_NOT_FOUND');
    expect(blocks.deleteByPair).not.toHaveBeenCalled();
  });
});
