import { Test, TestingModule } from '@nestjs/testing';
import { WorkflowResolver } from './workflow.resolver';

describe('WorkflowResolver', () => {
  let resolver: WorkflowResolver;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WorkflowResolver],
    }).compile();

    resolver = module.get<WorkflowResolver>(WorkflowResolver);
  });

  it('should be defined', () => {
    expect(resolver).toBeDefined();
  });
});
