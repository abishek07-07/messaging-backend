import { AcceptFriendRequestUsecase } from './accept-friend-request.usecase';
import {
  actorUser,
  friendshipsRepositoryMock,
  makeFriendship,
  otherUser,
  userBlocksRepositoryMock,
  usersRepositoryMock,
} from './friends.fixtures';
import type { FriendshipsRepository } from '../repository/friendships.repository';
import type { UserBlocksRepository } from '../repository/user-blocks.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';

describe('AcceptFriendRequestUsecase', () => {
  let usecase: AcceptFriendRequestUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;
  let blocks: jest.Mocked<UserBlocksRepository>;

  const request = makeFriendship({
    requester_id: otherUser.id,
    addressee_id: actorUser.id,
  });

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    blocks = userBlocksRepositoryMock();
    usecase = new AcceptFriendRequestUsecase(users, friendships, blocks);

    users.findByPublicId.mockResolvedValue(actorUser);
    friendships.findByPublicId.mockResolvedValue(request);
    blocks.existsBetween.mockResolvedValue(false);
    friendships.updateStatus.mockResolvedValue(
      makeFriendship({
        requester_id: otherUser.id,
        addressee_id: actorUser.id,
        status: 'accepted',
      }),
    );
    users.findById.mockResolvedValue(otherUser);
  });

  it('accepts a pending request and returns the new friend', async () => {
    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      requestPublicId: request.public_id,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }
    expect(result.data.status).toBe('accepted');
    expect(result.data.user).toMatchObject({
      id: otherUser.public_id,
      username: otherUser.username,
    });
    expect(friendships.updateStatus).toHaveBeenCalledWith(
      request.public_id,
      'accepted',
    );
  });

  it('fails when the request does not exist', async () => {
    friendships.findByPublicId.mockResolvedValue(null);

    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      requestPublicId: request.public_id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('FRIEND_REQUEST_NOT_FOUND');
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
    expect(friendships.updateStatus).not.toHaveBeenCalled();
  });

  it('fails when the request is no longer pending', async () => {
    friendships.findByPublicId.mockResolvedValue(
      makeFriendship({
        requester_id: otherUser.id,
        addressee_id: actorUser.id,
        status: 'declined',
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
