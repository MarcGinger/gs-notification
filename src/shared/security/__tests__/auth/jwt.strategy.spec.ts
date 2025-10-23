import { Test, TestingModule } from '@nestjs/testing';
// removed unused UnauthorizedException import
import { JwtStrategy } from '../../auth/jwt.strategy';
import { SecurityConfigService } from '../../config/security-config.service';
import { TokenToUserMapper } from '../../auth/token-to-user.mapper';
import { JwtPayload } from '../../types/jwt-payload.interface';
// removed unused AuthErrors import

describe('JwtStrategy', () => {
  /* eslint-disable @typescript-eslint/no-unsafe-argument,@typescript-eslint/no-unsafe-assignment,@typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call -- Reason: test mocks intentionally use `any` and unbound methods for simulating external services; these are test-only patterns. Ticket: TICKET-0003 */
  let strategy: JwtStrategy;
  let mockSecurityConfigService: any;
  let mockTokenMapper: any;

  beforeEach(async () => {
    // Mock SecurityConfigService
    mockSecurityConfigService = {
      getValidatedJwtConfigSafe: jest.fn().mockReturnValue({
        ok: true,
        value: {
          issuer: 'https://auth.example.com/realms/test',
          audience: 'test-api',
          cacheMaxAge: 3600000,
          requestsPerMinute: 10,
          timeoutMs: 30000,
        },
      }),
      getJwksUriSafe: jest.fn().mockReturnValue({
        ok: true,
        value:
          'https://auth.example.com/realms/test/protocol/openid-connect/certs',
      }),
    } as any;

    // Mock TokenToUserMapper
    mockTokenMapper = {
      mapToUserToken: jest.fn().mockReturnValue({
        sub: 'user-123',
        email: 'test@example.com',
        roles: ['user'],
        tenant: 'default',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        {
          provide: SecurityConfigService,
          useValue: mockSecurityConfigService,
        },
        {
          provide: TokenToUserMapper,
          useValue: mockTokenMapper,
        },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  describe('validate', () => {
    it('should successfully validate a valid JWT payload', () => {
      const validPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'https://auth.example.com/realms/test',
        aud: 'test-api',
        preferred_username: 'testuser',
        tenant: 'default',
        roles: ['user'],
      };

      const result = strategy.validate(validPayload);

      expect(result).toBeDefined();
      expect(mockTokenMapper.mapToUserToken).toHaveBeenCalledWith(validPayload);
    });

    it('should throw AuthErrors.invalidPayload for null payload', () => {
      expect(() => strategy.validate(null as any)).toThrow();
    });

    it('should throw AuthErrors.invalidPayload for non-object payload', () => {
      expect(() => strategy.validate('invalid' as any)).toThrow();
    });

    it('should throw AuthErrors.subjectMissing when sub is missing', () => {
      const invalidPayload = {
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      } as JwtPayload;

      expect(() => strategy.validate(invalidPayload)).toThrow();
    });

    it('should throw AuthErrors.tokenMappingFailed when mapper fails', () => {
      const validPayload: JwtPayload = {
        sub: 'user-123',
        email: 'test@example.com',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
        iss: 'https://auth.example.com/realms/test',
        aud: 'test-api',
        preferred_username: 'testuser',
        tenant: 'default',
        roles: ['user'],
      };

      mockTokenMapper.mapToUserToken.mockImplementationOnce(() => {
        throw new Error('Mapping failed');
      });

      expect(() => strategy.validate(validPayload)).toThrow();
    });
  });

  describe('configuration', () => {
    it('should call SecurityConfigService for JWT config', () => {
      expect(
        mockSecurityConfigService.getValidatedJwtConfigSafe,
      ).toHaveBeenCalled();
      expect(mockSecurityConfigService.getJwksUriSafe).toHaveBeenCalled();
    });
  });
});
