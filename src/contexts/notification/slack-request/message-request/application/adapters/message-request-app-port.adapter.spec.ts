/**
 * Quick test to verify the MessageRequest Application Port implementation
 * Phase 2: Verify domain aggregate functionality and integration
 */

import { Test, TestingModule } from '@nestjs/testing';
import { MessageRequestAppPortAdapter } from './message-request-app-port.adapter';
import { MESSAGE_REQUEST_APP_PORT } from '../ports/message-request-app.port';
import { IMessageRequestReader, MESSAGE_REQUEST_READER_TOKEN } from '../ports';
import { IMessageRequestWriter, MESSAGE_REQUEST_WRITER_TOKEN } from '../ports';
import { Option } from 'src/shared/domain/types/option';
import { ok } from 'src/shared/errors';
import { MessageRequestSnapshotProps } from '../../domain/props/message-request-snapshot.props';
import { MessageRequestAggregate } from '../../domain/aggregates/message-request.aggregate';

describe('MessageRequest Application Port (Phase 2)', () => {
  let adapter: MessageRequestAppPortAdapter;
  let reader: jest.Mocked<IMessageRequestReader>;
  let writer: jest.Mocked<IMessageRequestWriter>;

  const mockSnapshot: MessageRequestSnapshotProps = {
    id: '6f7c085d-2bce-4ab3-854a-6362745ba674',
    recipient: 'user123',
    data: { message: 'test' },
    status: 'queued' as const,
    workspaceCode: 'test-workspace',
    templateCode: 'test-template',
    channelCode: 'test-channel',
    createdAt: new Date('2025-10-01T00:00:00Z'),
    updatedAt: new Date('2025-10-01T00:00:00Z'),
    version: 1,
  };

  beforeEach(async () => {
    const mockReader = {
      findById: jest.fn(),
      exists: jest.fn(),
      getVersion: jest.fn(),
      getMinimal: jest.fn(),
    } as jest.Mocked<IMessageRequestReader>;

    const mockWriter = {
      save: jest.fn(),
      delete: jest.fn(),
    } as jest.Mocked<IMessageRequestWriter>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        {
          provide: MESSAGE_REQUEST_APP_PORT,
          useClass: MessageRequestAppPortAdapter,
        },
        {
          provide: MESSAGE_REQUEST_READER_TOKEN,
          useValue: mockReader,
        },
        {
          provide: MESSAGE_REQUEST_WRITER_TOKEN,
          useValue: mockWriter,
        },
      ],
    }).compile();

    adapter = module.get<MessageRequestAppPortAdapter>(
      MESSAGE_REQUEST_APP_PORT,
    );
    reader = module.get(MESSAGE_REQUEST_READER_TOKEN);
    writer = module.get(MESSAGE_REQUEST_WRITER_TOKEN);
  });

  it('should be defined', () => {
    expect(adapter).toBeDefined();
  });

  describe('recordSent', () => {
    it('should record successful delivery (Phase 2 - domain aggregates)', async () => {
      // Arrange
      reader.findById.mockResolvedValue(ok(Option.some(mockSnapshot)));
      writer.save.mockResolvedValue(
        ok({
          stream: 'test-stream',
          aggregateId: 'test-message-id',
          tenant: 'test-tenant',
          eventCount: 1,
          streamRevision: '1',
          timestampIso: new Date().toISOString(),
        }),
      );

      // Act & Assert
      await expect(
        adapter.recordSent({
          id: '6f7c085d-2bce-4ab3-854a-6362745ba674',
          tenant: 'test-tenant',
          slackTs: '1234567890.123456',
          slackChannel: '#test-channel',
          attempts: 1,
          correlationId: 'test-correlation',
          actor: { userId: 'user123', roles: ['user'] },
        }),
      ).resolves.toBeUndefined();

      // Verify repository interactions
      expect(reader.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: 'test-tenant',
          userId: 'user123',
          tenant_userId: 'user123',
          roles: ['user'],
        }),
        expect.any(Object), // MessageRequestId
      );

      expect(writer.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: 'test-tenant',
          userId: 'user123',
        }),
        expect.any(MessageRequestAggregate),
      );
    });

    it('should throw error when message request not found', async () => {
      // Arrange
      const nonexistentId = '987fcdeb-51d2-4567-b890-123456789abc';
      reader.findById.mockResolvedValue(ok(Option.none()));

      // Act & Assert
      await expect(
        adapter.recordSent({
          id: nonexistentId,
          tenant: 'test-tenant',
          slackTs: '1234567890.123456',
          slackChannel: '#test-channel',
          attempts: 1,
        }),
      ).rejects.toThrow(`MessageRequest not found: ${nonexistentId}`);
    });
  });

  describe('recordFailed', () => {
    it('should record failed delivery (Phase 2 - domain aggregates)', async () => {
      // Arrange
      reader.findById.mockResolvedValue(ok(Option.some(mockSnapshot)));
      writer.save.mockResolvedValue(
        ok({
          stream: 'test-stream',
          aggregateId: 'test-message-id',
          tenant: 'test-tenant',
          eventCount: 1,
          streamRevision: '1',
          timestampIso: new Date().toISOString(),
        }),
      );

      // Act & Assert
      await expect(
        adapter.recordFailed({
          id: '6f7c085d-2bce-4ab3-854a-6362745ba674',
          tenant: 'test-tenant',
          reason: 'invalid_auth',
          attempts: 3,
          retryable: false,
          lastError: 'Authentication failed',
          correlationId: 'test-correlation',
          actor: { userId: 'user123', roles: ['user'] },
        }),
      ).resolves.toBeUndefined();

      // Verify repository interactions
      expect(reader.findById).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: 'test-tenant',
          userId: 'user123',
          tenant_userId: 'user123',
          roles: ['user'],
        }),
        expect.any(Object), // MessageRequestId
      );

      expect(writer.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tenant: 'test-tenant',
          userId: 'user123',
        }),
        expect.any(MessageRequestAggregate),
      );
    });
  });
});
