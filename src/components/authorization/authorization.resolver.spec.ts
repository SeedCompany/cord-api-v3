import { Test, TestingModule } from '@nestjs/testing';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthenticationModule } from '../authentication';
import { AuthorizationResolver } from './authorization.resolver';
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

describe('AuthorizationResolver', () => {
  let resolver: AuthorizationResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [LoggerModule.forRoot(), CoreModule, AuthenticationModule],
      providers: [
        AuthorizationService,
        AuthorizationResolver,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    resolver = module.get<AuthorizationResolver>(AuthorizationResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
