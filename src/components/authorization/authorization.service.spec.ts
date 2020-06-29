import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthenticationModule } from '../authentication/authentication.module';
import { AuthorizationService } from './authorization.service';

const mockDbService = {
  createNode: () => ({}),
  query: () => ({
    raw: () => ({
      run: () => ({}),
      first: () => ({}),
    }),
  }),
  readProperties: () => ({}),
  deleteNode: () => ({}),
};

describe('AuthorizationService', () => {
  let service: AuthorizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forTest(), CoreModule, AuthenticationModule],
      providers: [
        AuthorizationService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    service = module.get<AuthorizationService>(AuthorizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
