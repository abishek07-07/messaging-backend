import { DeclineFriendRequestUsecase } from './decline-friend-request.usecase';
import {
  actorUser,
  friendshipsRepositoryMock,
  makeFriendship,
  otherUser,
  usersRepositoryMock,
} from './friends.fixtures';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('DeclineFriendRequestUsecase', () => {
  let usecase: DeclineFriendRequestUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;

  const request = makeFriendship({
    requester_id: otherUser.id,
    addressee_id: actorUser.id,
  });

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    usecase = new DeclineFriendRequestUsecase(users, friendships);

    users.findByPublicId.mockResolvedValue(actorUser);
    friendships.findByPublicId.mockResolvedValue(request);
    friendships.updateStatus.mockResolvedValue(
      makeFriendship({
        requester_id: otherUser.id,
        addressee_id: actorUser.id,
        status: 'declined',
      }),
    );
    users.findById.mockResolvedValue(otherUser);
  });

  it('declines a pending request and keeps the row for a future retry', async () => {
    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      requestPublicId: request.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }
    expect(result.data.status).toBe('declined');
    expect(friendships.updateStatus).toHaveBeenCalledWith(
      request.public_id,
      'declined',
    );
  });

  it('fails when the caller is not the addressee', async () => {
    friendships.findByPublicId.mockResolvedValue(
      makeFriendship({ addressee_id: '999' }),
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

  it('fails when the request is not pending', async () => {
    friendships.findByPublicId.mockResolvedValue(
      makeFriendship({
        requester_id: otherUser.id,
        addressee_id: actorUser.id,
        status: 'accepted',
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
    expect(result.error.statusCode).toBe('FRIEND_REQUEST_NOT_PENDING');
  });
});
