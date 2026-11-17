import { SendMessageUsecase } from './send-message.usecase';
import { EditMessageUsecase } from './edit-message.usecase';
import { DeleteMessageUsecase } from './delete-message.usecase';
import { MarkConversationReadUsecase } from './mark-conversation-read.usecase';
import {
  actorUser,
  conversationsRepositoryMock,
  makeConversation,
  makeMessage,
  makeMessageView,
  messagesRepositoryMock,
  peerSender,
  peerUser,
  userBlocksRepositoryMock,
  usersRepositoryMock,
} from './messages.fixtures';
import type { ConversationsRepository } from '@features/conversations/repository/conversations.repository';
import type { MessagesRepository } from '../repository/messages.repository';
import type { UsersRepository } from '@features/auth/repository/users.repository';
import type { UserBlocksRepository } from '@features/friends/repository/user-blocks.repository';

const actorSender = {
  public_id: actorUser.public_id,
  username: actorUser.username,
  display_name: actorUser.display_name,
  avatar_url: actorUser.avatar_url,
  public_key: actorUser.public_key,
};

const conversation = makeConversation();

describe('message write usecases', () => {
  let users: jest.Mocked<UsersRepository>;
  let conversations: jest.Mocked<ConversationsRepository>;
  let messages: jest.Mocked<MessagesRepository>;
  let blocks: jest.Mocked<UserBlocksRepository>;

  beforeEach(() => {
    users = usersRepositoryMock();
    conversations = conversationsRepositoryMock();
    messages = messagesRepositoryMock();
    blocks = userBlocksRepositoryMock();

    users.findByPublicId.mockResolvedValue(actorUser);
    conversations.findByPublicId.mockResolvedValue(conversation);
    conversations.isMember.mockResolvedValue(true);
    conversations.findOtherParticipantInternalId.mockResolvedValue(peerUser.id);
    blocks.existsBetween.mockResolvedValue(false);
    messages.findBySenderAndClientId.mockResolvedValue(null);
    messages.findByPublicIdInConversation.mockResolvedValue(null);
  });

  describe('SendMessageUsecase', () => {
    let usecase: SendMessageUsecase;

    beforeEach(() => {
      usecase = new SendMessageUsecase(
        users,
        conversations,
        messages,
        blocks,
      );
    });

    it('trims the content and stores a text message', async () => {
      const created = makeMessage({
        sender_id: actorUser.id,
        content: 'hello',
      });
      messages.create.mockResolvedValue(created);
      messages.findViewById.mockResolvedValue(
        makeMessageView(created, actorSender),
      );

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        conversationPublicId: conversation.public_id,
        content: '  hello  ',
        clientMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      });

      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error(`expected success, got ${result.error.statusCode}`);
      }

      expect(messages.create).toHaveBeenCalledWith({
        conversation_id: conversation.id,
        sender_id: actorUser.id,
        client_message_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        type: 'text',
        content: 'hello',
        encoding: 'plaintext',
        reply_to_id: null,
      });
      expect(result.data).toMatchObject({
        id: created.public_id,
        content: 'hello',
        isMine: true,
      });
    });

    it('stores an encrypted message with its wrapped keys', async () => {
      const cryptoMetadata = {
        senderKey: 'sender-public-key',
        keys: {
          [actorUser.public_id]: 'wrapped-for-sender',
          [peerUser.public_id]: 'wrapped-for-recipient',
        },
      };
      const created = makeMessage({
        sender_id: actorUser.id,
        content: 'base64-ciphertext',
        encoding: 'e2ee',
        crypto_metadata: cryptoMetadata,
      });
      messages.create.mockResolvedValue(created);
      messages.findViewById.mockResolvedValue(
        makeMessageView(created, actorSender),
      );

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        conversationPublicId: conversation.public_id,
        content: 'base64-ciphertext',
        encoding: 'e2ee',
        cryptoMetadata,
      });

      expect(result.success).toBe(true);
      expect(messages.create).toHaveBeenCalledWith({
        conversation_id: conversation.id,
        sender_id: actorUser.id,
        client_message_id: null,
        type: 'text',
        content: 'base64-ciphertext',
        encoding: 'e2ee',
        crypto_metadata: cryptoMetadata,
        reply_to_id: null,
      });
      expect(result.data).toMatchObject({
        encoding: 'e2ee',
        cryptoMetadata,
      });
    });

    it('returns the existing message for a repeated client message id', async () => {
      const existing = makeMessage({
        sender_id: actorUser.id,
        client_message_id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      });
      messages.findBySenderAndClientId.mockResolvedValue(existing);
      messages.findViewById.mockResolvedValue(
        makeMessageView(existing, actorSender),
      );

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        conversationPublicId: conversation.public_id,
        content: 'hello',
        clientMessageId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      });

      expect(result.success).toBe(true);
      expect(messages.create).not.toHaveBeenCalled();
    });

    it('refuses to message a blocked peer', async () => {
      blocks.existsBetween.mockResolvedValue(true);

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        conversationPublicId: conversation.public_id,
        content: 'hello',
      });

      expect(result.success).toBe(false);
      if (result.success) {
        throw new Error('expected a failure response');
      }
      expect(result.error.statusCode).toBe('USER_BLOCKED');
      expect(messages.create).not.toHaveBeenCalled();
    });

    it('hides conversations from non-members', async () => {
      conversations.isMember.mockResolvedValue(false);

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        conversationPublicId: conversation.public_id,
        content: 'hello',
      });

      expect(result.success).toBe(false);
      if (result.success) {
        throw new Error('expected a failure response');
      }
      expect(result.error.statusCode).toBe('CONVERSATION_NOT_FOUND');
      expect(messages.create).not.toHaveBeenCalled();
    });
  });

  describe('EditMessageUsecase', () => {
    let usecase: EditMessageUsecase;

    beforeEach(() => {
      usecase = new EditMessageUsecase(users, conversations, messages);
    });

    it('updates an owned text message', async () => {
      const message = makeMessage({
        sender_id: actorUser.id,
        content: 'old',
      });
      messages.findByPublicId.mockResolvedValue(message);
      messages.updateContent.mockResolvedValue({
        ...message,
        content: 'new',
        edited_at: new Date(),
      });
      messages.findViewById.mockResolvedValue(
        makeMessageView(
          { ...message, content: 'new', edited_at: new Date() },
          actorSender,
        ),
      );

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        messagePublicId: message.public_id,
        content: ' new ',
      });

      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error(`expected success, got ${result.error.statusCode}`);
      }
      expect(messages.updateContent).toHaveBeenCalledWith(
        message.public_id,
        'new',
      );
      expect(result.data.content).toBe('new');
    });

    it("refuses to edit someone else's message", async () => {
      messages.findByPublicId.mockResolvedValue(
        makeMessage({ sender_id: peerUser.id }),
      );

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        messagePublicId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
        content: 'hijacked',
      });

      expect(result.success).toBe(false);
      if (result.success) {
        throw new Error('expected a failure response');
      }
      expect(result.error.statusCode).toBe('FORBIDDEN');
      expect(messages.updateContent).not.toHaveBeenCalled();
    });
  });

  describe('DeleteMessageUsecase', () => {
    let usecase: DeleteMessageUsecase;

    beforeEach(() => {
      usecase = new DeleteMessageUsecase(users, conversations, messages);
    });

    it('soft-deletes an owned message', async () => {
      const message = makeMessage({ sender_id: actorUser.id });
      messages.findByPublicId.mockResolvedValue(message);
      messages.softDelete.mockResolvedValue({
        ...message,
        content: null,
        deleted_at: new Date(),
      });
      messages.findViewById.mockResolvedValue(
        makeMessageView(
          { ...message, content: null, deleted_at: new Date() },
          actorSender,
        ),
      );

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        messagePublicId: message.public_id,
      });

      expect(result.success).toBe(true);
      expect(messages.softDelete).toHaveBeenCalledWith(message.public_id);
    });
  });

  describe('MarkConversationReadUsecase', () => {
    let usecase: MarkConversationReadUsecase;

    beforeEach(() => {
      usecase = new MarkConversationReadUsecase(
        users,
        conversations,
        messages,
      );
    });

    it('advances the cursor and reports the remaining unread count', async () => {
      const message = makeMessage({ sender_id: peerUser.id });
      messages.findByPublicIdInConversation.mockResolvedValue(message);
      messages.countUnread.mockResolvedValue(0);

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        conversationPublicId: conversation.public_id,
        messageId: message.public_id,
      });

      expect(result.success).toBe(true);
      if (!result.success) {
        throw new Error(`expected success, got ${result.error.statusCode}`);
      }
      expect(messages.markRead).toHaveBeenCalledWith(
        conversation.id,
        actorUser.id,
        message.id,
      );
      expect(result.data.unreadCount).toBe(0);
    });

    it('rejects a message id from another conversation', async () => {
      messages.findByPublicIdInConversation.mockResolvedValue(null);

      const result = await usecase.execute({
        actorPublicId: actorUser.public_id,
        conversationPublicId: conversation.public_id,
        messageId: 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',
      });

      expect(result.success).toBe(false);
      if (result.success) {
        throw new Error('expected a failure response');
      }
      expect(result.error.statusCode).toBe('MESSAGE_NOT_FOUND');
      expect(messages.markRead).not.toHaveBeenCalled();
    });
  });
});
