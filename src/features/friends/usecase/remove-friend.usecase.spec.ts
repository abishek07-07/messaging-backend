import { RemoveFriendUsecase } from './remove-friend.usecase';
import {
  actorUser,
  friendshipsRepositoryMock,
  makeFriendship,
  otherUser,
  usersRepositoryMock,
} from './friends.fixtures';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('RemoveFriendUsecase', () => {
  let usecase: RemoveFriendUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;

  const friendship = makeFriendship({ status: 'accepted' });

  const command = {
    actorPublicId: actorUser.public_id,
    friendPublicId: otherUser.public_id,
  };

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    usecase = new RemoveFriendUsecase(users, friendships);

    users.findByPublicId
      .mockResolvedValueOnce(actorUser)
      .mockResolvedValueOnce(otherUser);
    friendships.findBetween.mockResolvedValue(friendship);
    friendships.deleteByPublicId.mockResolvedValue(1);
  });

  it('deletes the accepted friendship and returns the removed friend', async () => {
    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data).toMatchObject({
      id: friendship.public_id,
      user: { id: otherUser.public_id },
    });
    expect(friendships.deleteByPublicId).toHaveBeenCalledWith(
      friendship.public_id,
    );
  });

  it('fails when the users are not friends', async () => {
    friendships.findBetween.mockResolvedValue(null);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('FRIENDSHIP_NOT_FOUND');
    expect(friendships.deleteByPublicId).not.toHaveBeenCalled();
  });
});
