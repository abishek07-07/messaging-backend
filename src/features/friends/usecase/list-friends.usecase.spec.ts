import { ListFriendsUsecase } from './list-friends.usecase';
import {
  actorUser,
  friendshipsRepositoryMock,
  makeFriendship,
  makeFriendshipView,
  otherUser,
  usersRepositoryMock,
} from './friends.fixtures';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('ListFriendsUsecase', () => {
  let usecase: ListFriendsUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    usecase = new ListFriendsUsecase(users, friendships);
  });

  it('returns every accepted friend', async () => {
    const friendship = makeFriendship({ status: 'accepted' });
    users.findByPublicId.mockResolvedValue(actorUser);
    friendships.listFriends.mockResolvedValue([
      makeFriendshipView(friendship, otherUser),
    ]);

    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.friends).toHaveLength(1);
    expect(result.data.friends[0]).toMatchObject({
      id: friendship.public_id,
      user: { id: otherUser.public_id, username: otherUser.username },
      friendsSince: friendship.updated_at,
    });
    expect(friendships.listFriends).toHaveBeenCalledWith(actorUser.id);
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
