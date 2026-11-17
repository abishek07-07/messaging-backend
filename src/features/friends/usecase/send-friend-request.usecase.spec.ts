import type { SendFriendRequestCommand } from './send-friend-request.usecase';
import { SendFriendRequestUsecase } from './send-friend-request.usecase';
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

describe('SendFriendRequestUsecase', () => {
  let usecase: SendFriendRequestUsecase;
  let users: jest.Mocked<UsersRepository>;
  let friendships: jest.Mocked<FriendshipsRepository>;
  let blocks: jest.Mocked<UserBlocksRepository>;

  const command: SendFriendRequestCommand = {
    actorPublicId: actorUser.public_id,
    recipientPublicId: otherUser.public_id,
  };

  beforeEach(() => {
    users = usersRepositoryMock();
    friendships = friendshipsRepositoryMock();
    blocks = userBlocksRepositoryMock();
    usecase = new SendFriendRequestUsecase(users, friendships, blocks);

    users.findByPublicId
      .mockResolvedValueOnce(actorUser)
      .mockResolvedValueOnce(otherUser);
    blocks.existsBetween.mockResolvedValue(false);
    friendships.findBetween.mockResolvedValue(null);
    friendships.create.mockResolvedValue(makeFriendship());
  });

  it('creates a pending request addressed to the recipient public id', async () => {
    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(`expected success, got ${result.error.statusCode}`);
    }

    expect(result.data).toMatchObject({
      id: makeFriendship().public_id,
      status: 'pending',
    });
    expect(result.data.user).toMatchObject({
      id: otherUser.public_id,
      username: otherUser.username,
      displayName: otherUser.display_name,
      avatarUrl: otherUser.avatar_url,
    });
    expect(friendships.create).toHaveBeenCalledWith({
      requester_id: actorUser.id,
      addressee_id: otherUser.id,
      status: 'pending',
    });
  });

  it('refuses a request to self', async () => {
    const result = await usecase.execute({
      actorPublicId: actorUser.public_id,
      recipientPublicId: actorUser.public_id,
    });

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('CANNOT_FRIEND_SELF');
    expect(users.findByPublicId).toHaveBeenCalledTimes(1);
  });

  it('fails when the recipient does not exist', async () => {
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

  it('fails when either user has blocked the other', async () => {
    blocks.existsBetween.mockResolvedValue(true);

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('USER_BLOCKED');
    expect(friendships.create).not.toHaveBeenCalled();
  });

  it('fails when the users are already friends', async () => {
    friendships.findBetween.mockResolvedValue(
      makeFriendship({ status: 'accepted' }),
    );

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('ALREADY_FRIENDS');
  });

  it('fails when the caller already has a pending request out', async () => {
    friendships.findBetween.mockResolvedValue(
      makeFriendship({ status: 'pending' }),
    );

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('FRIEND_REQUEST_ALREADY_EXISTS');
  });

  it('tells the caller to accept when the request came from the other user', async () => {
    friendships.findBetween.mockResolvedValue(
      makeFriendship({
        requester_id: otherUser.id,
        addressee_id: actorUser.id,
        status: 'pending',
      }),
    );

    const result = await usecase.execute(command);

    expect(result.success).toBe(false);
    if (result.success) {
      throw new Error('expected a failure response');
    }
    expect(result.error.statusCode).toBe('FRIEND_REQUEST_ALREADY_RECEIVED');
  });

  it('re-opens a previously declined pair as pending', async () => {
    const declined = makeFriendship({ status: 'declined' });
    friendships.findBetween.mockResolvedValue(declined);
    friendships.reopen.mockResolvedValue(makeFriendship({ status: 'pending' }));

    const result = await usecase.execute(command);

    expect(result.success).toBe(true);
    expect(friendships.reopen).toHaveBeenCalledWith(
      declined.public_id,
      actorUser.id,
      otherUser.id,
    );
    expect(friendships.create).not.toHaveBeenCalled();
  });
});
