import { Injectable } from '@nestjs/common';
import {
  CreationFailed,
  DuplicateException,
  generateId,
  type ID,
  InputException,
  type ObjectView,
  Order,
  ServerException,
  viewOfChangeset,
} from '~/common';
import { HandleIdLookup, ResourceResolver } from '~/core';
import { mapListResults } from '~/core/database/results';
import { Privileges } from '../authorization';
import { FileService } from '../file';
import { type FileId } from '../file/dto';
import { ProjectChangeRequest } from '../project-change-request/dto';
import { BudgetRecordRepository } from './budget-record.repository';
import { BudgetRepository } from './budget.repository';
import {
  Budget,
  BudgetListInput,
  type BudgetListOutput,
  BudgetRecord,
  type BudgetRecordListInput,
  type BudgetRecordListOutput,
  BudgetStatus,
  type CreateBudget,
  type CreateBudgetRecord,
  type UpdateBudget,
  type UpdateBudgetRecord,
} from './dto';

@Injectable()
export class BudgetService {
  constructor(
    private readonly files: FileService,
    private readonly privileges: Privileges,
    private readonly budgetRepo: BudgetRepository,
    private readonly budgetRecordsRepo: BudgetRecordRepository,
    private readonly resources: ResourceResolver,
  ) {}

  async create({ projectId, ...input }: CreateBudget): Promise<Budget> {
    const universalTemplateFileId = await generateId<FileId>();

    try {
      const budgetId = await this.budgetRepo.create(
        { projectId, ...input },
        universalTemplateFileId,
      );

      await this.files.createDefinedFile(
        universalTemplateFileId,
        `Universal Budget Template`,
        budgetId,
        'universalTemplateFile',
        input.universalTemplateFile,
        'budget.universalTemplateFile',
      );

      return await this.readOne(budgetId);
    } catch (exception) {
      throw new CreationFailed(Budget, { cause: exception });
    }
  }

  async createRecord(input: CreateBudgetRecord, changeset?: ID): Promise<BudgetRecord> {
    const { organizationId, fiscalYear } = input;

    if (!fiscalYear || !organizationId) {
      throw new InputException(!fiscalYear ? 'budget.fiscalYear' : 'budget.organizationId');
    }

    await this.verifyRecordUniqueness(input);

    try {
      const recordId = await this.budgetRecordsRepo.create(input, changeset);

      const budgetRecord = await this.readOneRecord(recordId, viewOfChangeset(changeset));

      return budgetRecord;
    } catch (exception) {
      throw new CreationFailed(BudgetRecord, { cause: exception });
    }
  }

  private async verifyRecordUniqueness(input: CreateBudgetRecord) {
    const exists = await this.budgetRecordsRepo.doesRecordExist(input);
    if (exists) {
      throw new DuplicateException(
        'fiscalYear',
        'A record for given partner and fiscal year already exists in this budget',
      );
    }
  }

  @HandleIdLookup(Budget)
  async readOne(id: ID, view?: ObjectView): Promise<Budget> {
    const result = await this.budgetRepo.readOne(id, view);

    const privs = this.privileges.for(Budget, result);

    let records = null;
    if (privs.can('read', 'records')) {
      records = await this.listRecords(
        {
          sort: 'fiscalYear',
          order: Order.ASC,
          page: 1,
          count: 25,
          filter: { budgetId: id },
        },
        view,
      );
    }

    const changeRequest = view?.changeset
      ? await this.resources.lookup(ProjectChangeRequest, view.changeset)
      : undefined;

    return {
      ...privs.secure(result),
      // Show budget status as Pending, to allow budget record changes,
      // if we are in an editable change request.
      status: changeRequest?.canEdit ? BudgetStatus.Pending : result.status,
      records: records?.items || [],
    };
  }

  async readMany(ids: readonly ID[], view?: ObjectView) {
    const budgets = await this.budgetRepo.readMany(ids, view);
    return await Promise.all(budgets.map(async (dto) => await this.readOne(dto.id, view)));
  }

  @HandleIdLookup(BudgetRecord)
  async readOneRecord(id: ID, view?: ObjectView): Promise<BudgetRecord> {
    const result = await this.budgetRecordsRepo.readOne(id, { view });

    return this.privileges.for(BudgetRecord).secure(result);
  }

  async update(input: UpdateBudget): Promise<Budget> {
    const budget = await this.readOne(input.id);

    const changes = this.budgetRepo.getActualChanges(budget, input);
    this.privileges.for(Budget, budget).verifyChanges(changes);
    const { universalTemplateFile, ...simpleChanges } = changes;
    await this.files.updateDefinedFile(
      budget.universalTemplateFile,
      'budget.universalTemplateFile',
      universalTemplateFile,
    );
    return await this.budgetRepo.update(budget, simpleChanges);
  }

  async updateRecord({ id, ...input }: UpdateBudgetRecord, changeset?: ID): Promise<BudgetRecord> {
    const br = await this.readOneRecord(id, viewOfChangeset(changeset));
    const changes = this.budgetRecordsRepo.getActualChanges(br, input);
    this.privileges.for(BudgetRecord, br).verifyChanges(changes);

    const result = await this.budgetRecordsRepo.update(br, changes, changeset);
    return result;
  }

  async delete(id: ID): Promise<void> {
    const budget = await this.readOne(id);

    // cascade delete each budget record in this budget
    await Promise.all(budget.records.map((br) => this.deleteRecord(br.id)));

    try {
      await this.budgetRepo.deleteNode(budget);
    } catch (e) {
      throw new ServerException('Failed to delete budget', e);
    }
  }

  async deleteRecord(id: ID, changeset?: ID): Promise<void> {
    try {
      await this.budgetRecordsRepo.deleteNode(id, { changeset });
    } catch (e) {
      throw new ServerException('Failed to delete Budget Record', e);
    }
  }

  async list(partialInput: Partial<BudgetListInput>, changeset?: ID): Promise<BudgetListOutput> {
    const input = BudgetListInput.defaultValue(BudgetListInput, partialInput);
    const results = await this.budgetRepo.list(input);
    return await mapListResults(results, (id) => this.readOne(id, viewOfChangeset(changeset)));
  }

  async listUnsecure(
    partialInput: Partial<BudgetListInput>,
    changeset?: ID,
  ): Promise<BudgetListOutput> {
    const input = BudgetListInput.defaultValue(BudgetListInput, partialInput);
    const results = await this.budgetRepo.listUnsecure(input);
    return await mapListResults(results, (id) => this.readOne(id, viewOfChangeset(changeset)));
  }

  async listRecords(
    input: BudgetRecordListInput,
    view?: ObjectView,
  ): Promise<BudgetRecordListOutput> {
    const results = await this.budgetRecordsRepo.list(input, view);

    return await mapListResults(results, (id) => this.readOneRecord(id, view));
  }
}
