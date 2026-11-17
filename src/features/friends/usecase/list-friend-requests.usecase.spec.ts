import { ListFriendRequestsUsecase } from './list-friend-requests.usecase';
import {
  actorUser,
  friendshipsRepositoryMock,
  makeFriendship,
  makeFriendshipView,
  usersRepositoryMock,
} from './friends.fixtures';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('ListFriendRequestsUsecase', () => {
  let usecase: ListFriendRequestsUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    usecase = new ListFriendRequestsUsecase(users, friendships);
  });

  it('returns incoming and outgoing pending requests', async () => {
    const view = makeFriendshipView();
    users.findByPublicId.mockResolvedValue(actorUser);
    friendships.listIncomingRequests.mockResolvedValue([view]);
    friendships.listOutgoingRequests.mockResolvedValue([view]);

    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data.incoming).toHaveLength(1);
    expect(result.data.outgoing).toHaveLength(1);
    expect(result.data.incoming[0]).toMatchObject({
      id: makeFriendship().public_id,
      status: 'pending',
      user: { id: '22222222-2222-4222-8222-222222222222' },
    });
    expect(friendships.listIncomingRequests).toHaveBeenCalledWith(actorUser.id);
    expect(friendships.listOutgoingRequests).toHaveBeenCalledWith(actorUser.id);
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
