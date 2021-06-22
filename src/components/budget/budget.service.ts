import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  InputException,
  NotFoundException,
  Order,
  ResourceShape,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { HandleIdLookup, ILogger, Logger, Property } from '../../core';
import {
  parseSecuredProperties,
  runListQuery,
} from '../../core/database/results';
import {
  AuthorizationService,
  PermissionsOf,
} from '../authorization/authorization.service';
import { FileService } from '../file';
import { BudgetRecordRepository } from './budget-record.repository';
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

@Injectable()
export class BudgetService {
  constructor(
    private readonly files: FileService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly budgetRepo: BudgetRepository,
    private readonly budgetRecordsRepo: BudgetRecordRepository,
    @Logger('budget:service') private readonly logger: ILogger
  ) {}

  async create(
    { projectId, ...input }: CreateBudget,
    session: Session
  ): Promise<Budget> {
    this.logger.debug('Creating budget', { projectId });

    const projectExists = await this.budgetRepo.doesProjectExist(
      projectId,
      session
    );
    if (!projectExists) {
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
      await this.budgetRepo.create(budgetId, secureProps, session);
      await this.budgetRepo.connectToProject(budgetId, projectId);

      this.logger.debug(`Created Budget`, {
        id: budgetId,
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

      await this.authorizationService.processNewBaseNode(
        Budget,
        budgetId,
        session.userId
      );

      return await this.readOne(budgetId, session);
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
    session: Session,
    changeset?: ID
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
      const recordId = await this.budgetRecordsRepo.create(
        session,
        secureProps
      );

      await this.budgetRecordsRepo.connectToBudget(
        recordId,
        budgetId,
        createdAt,
        changeset
      );
      await this.budgetRecordsRepo.connectToOrganization(
        recordId,
        organizationId,
        createdAt
      );

      await this.authorizationService.processNewBaseNode(
        BudgetRecord,
        recordId,
        session.userId
      );

      this.logger.debug(`Created Budget Record`, {
        id: recordId,
        userId: session.userId,
      });

      const budgetRecord = await this.readOneRecord(
        recordId,
        session,
        changeset
      );

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
    const exists = await this.budgetRecordsRepo.doesRecordExist(input);
    if (exists) {
      throw new DuplicateException(
        'fiscalYear',
        'A record for given partner and fiscal year already exists in this budget'
      );
    }
  }

  @HandleIdLookup(Budget)
  async readOne(id: ID, session: Session, changeset?: ID): Promise<Budget> {
    this.logger.debug(`readOne budget`, {
      id,
      userId: session.userId,
    });

    const result = await this.budgetRepo.readOne(id, session, changeset);

    const perms = await this.authorizationService.getPermissions({
      resource: Budget,
      sessionOrUserId: session,
      otherRoles: result.scope,
      dto: result as ResourceShape<Budget>['prototype'],
    });

    const securedProps = parseSecuredProperties(
      result,
      perms as PermissionsOf<Budget>,
      Budget.SecuredProps
    );

    let records = null;
    if (perms.records.canRead) {
      records = await this.listRecords(
        {
          sort: 'fiscalYear',
          order: Order.ASC,
          page: 1,
          count: 25,
          filter: { budgetId: id },
        },
        session,
        changeset
      );
    }

    return {
      ...result,
      ...securedProps,
      records: records?.items || [],
      canDelete: await this.budgetRepo.checkDeletePermission(id, session),
    };
  }

  @HandleIdLookup(BudgetRecord)
  async readOneRecord(
    id: ID,
    session: Session,
    changeset?: ID
  ): Promise<BudgetRecord> {
    this.logger.debug(`readOne BudgetRecord`, {
      id,
      userId: session.userId,
    });

    const result = await this.budgetRecordsRepo.readOne(id, session, changeset);

    const securedProps = await this.authorizationService.secureProperties(
      BudgetRecord,
      result,
      session,
      result.scope
    );

    return {
      ...result,
      ...securedProps,
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
    const changes = this.budgetRecordsRepo.getActualChanges(br, input);
    await this.authorizationService.verifyCanEditChanges(
      BudgetRecord,
      br,
      changes
    );

    try {
      const result = await this.budgetRecordsRepo.updateProperties(br, changes);
      return result;
    } catch (e) {
      this.logger.error('Could not update budget Record ', {
        id,
        userId: session.userId,
      });
      throw e;
    }
  }

  private async verifyCanEdit(recordId: ID, session: Session) {
    if (session.roles.includes('global:Administrator')) {
      return;
    }
    const status = await this.budgetRepo.getStatusByRecord(recordId);
    if (status !== BudgetStatus.Pending) {
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

    const canDelete = await this.budgetRepo.checkDeletePermission(id, session);
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

  async deleteRecord(id: ID, session: Session, changeset?: ID): Promise<void> {
    const br = await this.readOneRecord(id, session, changeset);

    if (!br) {
      throw new NotFoundException('Could not find Budget Record');
    }

    const canDelete = await this.budgetRecordsRepo.checkDeletePermission(
      id,
      session
    );

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Budget Record'
      );

    try {
      await this.budgetRecordsRepo.deleteNode(br);
    } catch (e) {
      this.logger.warning('Failed to delete Budget Record', {
        exception: e,
      });
      throw new ServerException('Failed to delete Budget Record');
    }
  }

  async list(
    partialInput: Partial<BudgetListInput>,
    session: Session,
    changeset?: ID
  ): Promise<BudgetListOutput> {
    const input = {
      ...BudgetListInput.defaultVal,
      ...partialInput,
    };
    const query = this.budgetRepo.list(input, session);

    return await runListQuery(query, input, (id) =>
      this.readOne(id, session, changeset)
    );
  }

  async listNoSecGroups(
    partialInput: Partial<BudgetListInput>,
    session: Session,
    changeset?: ID
  ): Promise<BudgetListOutput> {
    const input = {
      ...BudgetListInput.defaultVal,
      ...partialInput,
    };
    const query = this.budgetRepo.listNoSecGroups(input);

    return await runListQuery(query, input, (id) =>
      this.readOne(id, session, changeset)
    );
  }

  async listRecords(
    input: BudgetRecordListInput,
    session: Session,
    changeset?: ID
  ): Promise<BudgetRecordListOutput> {
    const query = this.budgetRecordsRepo.list(input, session, changeset);

    return await runListQuery(query, input, (id) =>
      this.readOneRecord(id, session, changeset)
    );
  }
}
