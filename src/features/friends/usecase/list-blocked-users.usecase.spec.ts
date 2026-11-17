import { ListBlockedUsersUsecase } from './list-blocked-users.usecase';
import {
  actorUser,
  otherUser,
  userBlock,
  userBlocksRepositoryMock,
  usersRepositoryMock,
} from './friends.fixtures';
import type { UserBlocksRepository } from '../repository/user-blocks.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('ListBlockedUsersUsecase', () => {
  let usecase: ListBlockedUsersUsecase;
  let users: jest.Mocked<UsersRepository>;
  let blocks: jest.Mocked<UserBlocksRepository>;

  beforeEach(() => {
    users = usersRepositoryMock();
    blocks = userBlocksRepositoryMock();
    usecase = new ListBlockedUsersUsecase(users, blocks);
  });

  it('returns every user blocked by the caller', async () => {
    users.findByPublicId.mockResolvedValue(actorUser);
    blocks.listBlocked.mockResolvedValue([
      { block: userBlock, user: otherUser },
    ]);

    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.blockedUsers).toHaveLength(1);
    expect(result.data.blockedUsers[0]).toMatchObject({
      id: userBlock.public_id,
      user: { id: otherUser.public_id, username: otherUser.username },
      blockedAt: userBlock.created_at,
    });
    expect(blocks.listBlocked).toHaveBeenCalledWith(actorUser.id);
  });

  it('fails when the authenticated account no longer exists', async () => {
    users.findByPublicId.mockResolvedValue(null);

    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('UNAUTHORIZED');
  });
});
