import { CancelFriendRequestUsecase } from './cancel-friend-request.usecase';
import {
  actorUser,
  friendshipsRepositoryMock,
  makeFriendship,
  otherUser,
  usersRepositoryMock,
} from './friends.fixtures';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('CancelFriendRequestUsecase', () => {
  let usecase: CancelFriendRequestUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;

  const request = makeFriendship();

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    usecase = new CancelFriendRequestUsecase(users, friendships);

    users.findByPublicId.mockResolvedValue(actorUser);
    friendships.findByPublicId.mockResolvedValue(request);
    friendships.updateStatus.mockResolvedValue(
      makeFriendship({ status: 'declined' }),
    );
    users.findById.mockResolvedValue(otherUser);
  });

  it('cancels a request sent by the caller', async () => {
    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      requestPublicId: request.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }
    expect(result.data.status).toBe('declined');
    expect(result.data.user).toMatchObject({ id: otherUser.public_id });
    expect(friendships.updateStatus).toHaveBeenCalledWith(
      request.public_id,
      'declined',
    );
  });

  it('fails when the caller is the addressee instead of the sender', async () => {
    friendships.findByPublicId.mockResolvedValue(
      makeFriendship({
        requester_id: otherUser.id,
        addressee_id: actorUser.id,
      }),
    );

    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      requestPublicId: request.public_id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('FORBIDDEN');
  });

  it('fails when the request is no longer pending', async () => {
    friendships.findByPublicId.mockResolvedValue(
      makeFriendship({ status: 'accepted' }),
    );

    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      requestPublicId: request.public_id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('FRIEND_REQUEST_NOT_PENDING');
  });
});
