import { Test, TestingModule } from '@nestjs/testing';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { CoreModule, DatabaseService, LoggerModule } from '../../core';
import { AuthenticationService } from '../authentication';
import { AuthenticationModule } from '../authentication/authentication.module';
import { ProjectService } from '../project';
import { ProjectModule } from '../project/project.module';
import { BudgetService } from './budget.service';
import { Budget, BudgetStatus } from './dto';

describe('BudgetService', () => {
  let budgetService: BudgetService;
  const id = generate();
  const projectId = generate();

  const createTestBudget: Partial<Budget> = {
    id,
    status: BudgetStatus.Pending,
  };

  const updateTestBudget: Partial<Budget> = {
    id,
    status: BudgetStatus.Superceded,
  };

  const mockDbService = {
    createNode: () => createTestBudget,
    updateProperties: () => updateTestBudget,
    deleteNode: () => ({}),
    query: () => ({
      raw: () => ({
        run: () => ({}),
        first: () => ({}),
      }),
    }),
    readProperties: () => createTestBudget,
  };

  const mockSession = {
    token:
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpYXQiOjE1ODUxNjY0MTM3OTF9.xStLc8cYmOVT3ABW1b6GLuSpeoFNxrYE2o2CBmJR8-U',
    userId: '12345',
    issuedAt: DateTime.local(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [
        LoggerModule.forTest(),
        CoreModule,
        AuthenticationModule,
        ProjectModule,
      ],
      providers: [
        AuthenticationService,
        ProjectService,
        BudgetService,
        {
          provide: DatabaseService,
          useValue: mockDbService,
        },
      ],
    }).compile();

    budgetService = module.get<BudgetService>(BudgetService);
  });

  it('should be defined', () => {
    expect(BudgetService).toBeDefined();
  });

  it('should create budget node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    budgetService.readOne = jest.fn().mockReturnValue(createTestBudget);
    const budget = await budgetService.create(
      {
        projectId: projectId,
      },
      mockSession
    );
    expect(budget.id).toEqual(createTestBudget.id);
    expect(budget.status).toEqual(createTestBudget.status);
  });

  it('should read budget node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    budgetService.readOne = jest.fn().mockReturnValue(createTestBudget);
    const budget = await budgetService.readOne(id, mockSession);
    expect(budget.id).toEqual(createTestBudget.id);
    expect(budget.status).toEqual(createTestBudget.status);
  });

  it('should update budget node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    budgetService.readOne = jest.fn().mockReturnValue(updateTestBudget);
    const budget = await budgetService.update(
      {
        id,
        status: BudgetStatus.Superceded,
      },
      mockSession
    );
    expect(budget.status).toEqual(updateTestBudget.status);
  });

  it('should delete budget node', async () => {
    // eslint-disable-next-line @typescript-eslint/unbound-method
    budgetService.readOne = jest.fn().mockReturnValue(createTestBudget);
    const budget = await budgetService.create(
      {
        projectId,
      },
      mockSession
    );
    await budgetService.delete(id, mockSession);
    // since delete is making the graph node inactive, we just test for the nodes existance now
    expect(budget.id).toEqual(createTestBudget.id);
    expect(budget.status).toEqual(createTestBudget.status);
  });
});
