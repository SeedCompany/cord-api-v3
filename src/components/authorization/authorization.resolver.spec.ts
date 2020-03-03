import { Test, TestingModule } from '@nestjs/testing';
import { AuthorizationResolver } from './authorization.resolver';

describe('AuthorizationResolver', () => {
  let resolver: AuthorizationResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AuthorizationResolver],
    }).compile();

    resolver = module.get<AuthorizationResolver>(AuthorizationResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
