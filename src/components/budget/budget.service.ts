import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  InputException,
  NotFoundException,
  Order,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ILogger, Logger, Property } from '../../core';
import { runListQuery } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { FileService } from '../file';
import { BudgetRepository } from './budget.repository';
import {
  Budget,
  BudgetListInput,
  BudgetListOutput,
  BudgetRecord,
  BudgetRecordListInput,
  BudgetRecordListOutput,
  BudgetStatus,
  CreateBudget,
  CreateBudgetRecord,
  UpdateBudget,
  UpdateBudgetRecord,
} from './dto';
import { DbBudget } from './model';
import { DbBudgetRecord } from './model/budget-record.model.db';

@Injectable()
export class BudgetService {
  constructor(
    private readonly files: FileService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly budgetRepo: BudgetRepository,
    @Logger('budget:service') private readonly logger: ILogger
  ) {}

  async create(
    { projectId, ...input }: CreateBudget,
    session: Session
  ): Promise<Budget> {
    this.logger.debug('Creating budget', { projectId });

    const readProject = this.budgetRepo.readProject(projectId, session);

    const result = await readProject.first();
    if (!result) {
      throw new NotFoundException('project does not exist', 'budget.projectId');
    }

    const budgetId = await generateId();

    const universalTemplateFileId = await generateId();

    const secureProps: Property[] = [
      {
        key: 'status',
        value: BudgetStatus.Pending,
        isPublic: false,
        isOrgPublic: false,
        label: 'BudgetStatus',
      },
      {
        key: 'universalTemplateFile',
        value: universalTemplateFileId,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const result = await this.budgetRepo.createBudget(
        projectId,
        budgetId,
        secureProps,
        session
      );

      this.logger.debug(`Created Budget`, {
        id: result?.id,
        userId: session.userId,
      });

      await this.files.createDefinedFile(
        universalTemplateFileId,
        `Universal Budget Template`,
        session,
        budgetId,
        'universalTemplateFile',
        input.universalTemplateFile,
        'budget.universalTemplateFile'
      );

      const dbBudget = new DbBudget();
      await this.authorizationService.processNewBaseNode(
        dbBudget,
        result?.id,
        session.userId
      );

      return await this.readOne(result?.id, session);
    } catch (exception) {
      this.logger.error(`Could not create budget`, {
        userId: session.userId,
        exception,
      });
      throw new ServerException('Could not create budget', exception);
    }
  }

  async createRecord(
    input: CreateBudgetRecord,
    session: Session
  ): Promise<BudgetRecord> {
    const { budgetId, organizationId, fiscalYear } = input;

    if (!fiscalYear || !organizationId) {
      throw new InputException(
        !fiscalYear ? 'budget.fiscalYear' : 'budget.organizationId'
      );
    }

    await this.verifyRecordUniqueness(input);

    this.logger.debug('Creating BudgetRecord', input);
    // on Init, create a budget will create a budget record for each org and each fiscal year in the project input.projectId
    const createdAt = DateTime.local();

    const secureProps: Property[] = [
      {
        key: 'fiscalYear',
        value: fiscalYear,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'amount',
        value: null,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const createBudgetRecord = await this.budgetRepo.createBudgetRecord(
        session,
        secureProps
      );
      const result = await createBudgetRecord.first();

      if (!result) {
        throw new ServerException('failed to create a budget record');
      }

      const orgQuery = await this.budgetRepo.connectBudget(
        budgetId,
        organizationId,
        result,
        createdAt
      );
      await orgQuery.first();

      const dbBudgetRecord = new DbBudgetRecord();
      await this.authorizationService.processNewBaseNode(
        dbBudgetRecord,
        result.id,
        session.userId
      );

      this.logger.debug(`Created Budget Record`, {
        id: result.id,
        userId: session.userId,
      });

      const budgetRecord = await this.readOneRecord(result.id, session);

      return budgetRecord;
    } catch (exception) {
      this.logger.error(`Could not create Budget Record`, {
        userId: session.userId,
        exception,
      });
      throw new ServerException('Could not create Budget Record', exception);
    }
  }

  private async verifyRecordUniqueness(input: CreateBudgetRecord) {
    const existingRecord = await this.budgetRepo.verifyRecordUniqueness(input);
    if (existingRecord) {
      throw new DuplicateException(
        'fiscalYear',
        'A record for given partner and fiscal year already exists in this budget'
      );
    }
  }

  async readOne(id: ID, session: Session): Promise<Budget> {
    this.logger.debug(`readOne budget`, {
      id,
      userId: session.userId,
    });

    const query = this.budgetRepo.readOne(id, session);

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find budget', 'budget.id');
    }

    const securedProps = await this.authorizationService.secureProperties({
      resource: Budget,
      props: result.props,
      sessionOrUserId: session,
      otherRoles: result.scopedRoles,
    });

    const records = await this.listRecords(
      {
        sort: 'fiscalYear',
        order: Order.ASC,
        page: 1,
        count: 25,
        filter: { budgetId: id },
      },
      session
    );

    return {
      ...result.props,
      ...securedProps,
      records: records.items,
      canDelete: await this.budgetRepo.checkDeletePermission(id, session),
    };
  }

  async readOneRecord(id: ID, session: Session): Promise<BudgetRecord> {
    this.logger.debug(`readOne BudgetRecord`, {
      id,
      userId: session.userId,
    });

    const query = this.budgetRepo.readOneRecord(id, session);

    const result = await query.first();

    if (!result) {
      throw new NotFoundException(
        'Could not find BudgetRecord',
        'budgetRecord.budgetId'
      );
    }

    const securedPropsByParent = await this.authorizationService.getPermissionsByProp(
      {
        resource: BudgetRecord,
        parentResource: Budget,
        sessionOrUserId: session,
        sensitivity: result.props.sensitivity,
        otherRoles: result.scopedRoles,
        parentProp: 'records',
        props: result.props,
      }
    );

    return {
      ...result.props,
      ...securedPropsByParent,
      canDelete: await this.budgetRepo.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdateBudget, session: Session): Promise<Budget> {
    const budget = await this.readOne(input.id, session);

    const changes = this.budgetRepo.getActualChanges(budget, input);
    await this.authorizationService.verifyCanEditChanges(
      Budget,
      budget,
      changes
    );
    const { universalTemplateFile, ...simpleChanges } = changes;
    await this.files.updateDefinedFile(
      budget.universalTemplateFile,
      'budget.universalTemplateFile',
      universalTemplateFile,
      session
    );
    return await this.budgetRepo.updateProperties(budget, simpleChanges);
  }

  async updateRecord(
    { id, ...input }: UpdateBudgetRecord,
    session: Session
  ): Promise<BudgetRecord> {
    this.logger.debug('Update budget record', { id, userId: session.userId });

    await this.verifyCanEdit(id, session);

    const br = await this.readOneRecord(id, session);
    const changes = this.budgetRepo.getActualRecordChanges(br, input);
    await this.authorizationService.verifyCanEditChanges(
      BudgetRecord,
      br,
      changes
    );

    try {
      const result = await this.budgetRepo.updateRecordProperties(br, changes);
      return result;
    } catch (e) {
      this.logger.error('Could not update budget Record ', {
        id,
        userId: session.userId,
      });
      throw e;
    }
  }

  private async verifyCanEdit(id: ID, session: Session) {
    if (session.roles.includes('global:Administrator')) {
      return;
    }
    const result = await this.budgetRepo.verifyCanEdit(id);

    if (!result) {
      throw new NotFoundException('Budget could not be found');
    }

    if (result.status !== BudgetStatus.Pending) {
      throw new InputException(
        'Budget cannot be modified',
        'budgetRecord.amount'
      );
    }
  }

  async delete(id: ID, session: Session): Promise<void> {
    const budget = await this.readOne(id, session);

    if (!budget) {
      throw new NotFoundException('Could not find Budget');
    }

    const canDelete = await this.budgetRepo.verifyCanEdit(id);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Budget'
      );

    // cascade delete each budget record in this budget
    await Promise.all(
      budget.records.map((br) => this.deleteRecord(br.id, session))
    );

    try {
      await this.budgetRepo.deleteNode(budget);
    } catch (e) {
      this.logger.warning('Failed to delete budget', {
        exception: e,
      });
      throw new ServerException('Failed to delete budget');
    }
  }

  async deleteRecord(id: ID, session: Session): Promise<void> {
    const br = await this.readOneRecord(id, session);

    if (!br) {
      throw new NotFoundException('Could not find Budget Record');
    }

    const canDelete = await this.budgetRepo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Budget Record'
      );

    try {
      await this.budgetRepo.deleteNode(br);
    } catch (e) {
      this.logger.warning('Failed to delete Budget Record', {
        exception: e,
      });
      throw new ServerException('Failed to delete Budget Record');
    }
  }

  async list(
    input: Partial<BudgetListInput>,
    session: Session
  ): Promise<BudgetListOutput> {
    const { filter, ...listInput } = {
      ...BudgetListInput.defaultVal,
      ...input,
    };
    const query = this.budgetRepo.list(filter, listInput, session);

    return await runListQuery(query, listInput, (id) =>
      this.readOne(id, session)
    );
  }

  async listRecords(
    { filter, ...input }: BudgetRecordListInput,
    session: Session
  ): Promise<BudgetRecordListOutput> {
    const query = this.budgetRepo.listRecords(filter, input, session);

    return await runListQuery(query, input, (id) =>
      this.readOneRecord(id, session)
    );
  }

  async checkBudgetConsistency(session: Session): Promise<boolean> {
    const budgets = await this.budgetRepo.findBudgets(session);

    return (
      (
        await Promise.all(
          budgets.map(async (budget) => {
            return await this.budgetRepo.budgetHasProperties(budget, session);
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          budgets.map(async (budget) => {
            return await this.budgetRepo.budgetIsUniqueProperties(
              budget,
              session
            );
          })
        )
      ).every((n) => n)
    );
  }
}
