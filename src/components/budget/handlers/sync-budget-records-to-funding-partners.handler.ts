import { ISession, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { PartnershipService } from '../../partnership';
import { Partnership, PartnershipType } from '../../partnership/dto';
import {
  PartnershipCreatedEvent,
  PartnershipDeletedEvent,
  PartnershipUpdatedEvent,
} from '../../partnership/events';
import { Project } from '../../project/dto';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';
import { BudgetRecord } from '../dto';

type SubscribedEvent =
  | ProjectUpdatedEvent
  | PartnershipCreatedEvent
  | PartnershipUpdatedEvent
  | PartnershipDeletedEvent;

@EventsHandler(
  ProjectUpdatedEvent,
  PartnershipCreatedEvent,
  PartnershipUpdatedEvent,
  PartnershipDeletedEvent
)
export class SyncBudgetRecordsToFundingPartners
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly budgets: BudgetService,
    private readonly partnershipService: PartnershipService,
    @Logger('budget:sync-partnerships') private readonly logger: ILogger
  ) {}

  // TODO: refactor into budget service or partnership service
  private async getBudgetIdForPartnership(partnership: Partnership) {
    const budgets = await this.db
      .query()
      .raw(
        'MATCH (:Partnership { id: $partnershipId })-[:partnership]-(el)-[:budget]-(budget:Budget)',
        { partnershipId: partnership.id }
      )
      .return('budget.id')
      .run();

    // TODO: determine if the business logic should allow for more then one budget per partnership
    return budgets[0]['budget.id'];
  }

  // TODO: refactor into projectsService
  private async getPartnershipsForProject(project: Project, session: ISession) {
    const partnershipIds = await this.db
      .query()
      .raw(
        'MATCH (:Project { id: $projectId })-[:partnership]-(partnership:Partnership)',
        { projectId: project.id }
      )
      .return('partnership.id')
      .run();

    const partnerships = await Promise.all(
      partnershipIds.map((partnershipId) =>
        this.partnershipService.readOne(
          partnershipId['partnership.id'],
          session
        )
      )
    );
    return partnerships;
  }

  // TODO: refactor into partnershipsService
  private async getExistingBudgetRecordYearsForPartnership(
    partnership: Partnership,
    session: ISession
  ) {
    const budgetId = await this.getBudgetIdForPartnership(partnership);
    const budget = await this.budgets.readOne(budgetId, session);

    return budget.records;
  }

  private calculateExpectedBudgetRecordYears(partnership: Partnership) {
    let expectedBudgetRecordYears: number[];
    if (
      !partnership.mouStart?.value ||
      !partnership.mouEnd?.value ||
      // TODO: decide whether to move the following funding and type checks to an earlier step.
      !partnership.types.value.includes(PartnershipType.Funding) || // Partnership is not funding, so do nothing
      !partnership.types?.value // Partnership Type is not provided, so do nothing.
    ) {
      expectedBudgetRecordYears = [];
    } else {
      // TODO: mous starting at midnight on Jan 1st might cause issues with UTC vs local issues here.
      // double check how year should be calculated
      const mouStartYear = partnership.mouStart.value.year;
      const mouEndYear = partnership.mouEnd.value.year;

      expectedBudgetRecordYears = Array.from(
        { length: mouEndYear - mouStartYear },
        (_v, k) => k + mouStartYear
      );
    }
    return expectedBudgetRecordYears;
  }

  // TODO: refactor into partnershipsService
  private async getOrganizationIdByPartnership(partnership: Partnership) {
    // TODO: refactor so that partnership.organization.id returns a value instead of undefined.
    // this is currently a workaround because of the partnership.organization.id returning undefined.
    const organization = await this.db
      .query()
      .raw(
        'MATCH (:Partnership { id: $partnershipId })-[:organization]-(organization:Organization)',
        { partnershipId: partnership.id }
      )
      .return('organization.id')
      .run();

    // TODO: determine if the business logic should allow for more then one budget per partnership
    return organization[0]['organization.id'];
  }

  private async createMissingBudgetRecords(
    partnership: Partnership,
    session: ISession,
    existing: readonly BudgetRecord[],
    expected: number[]
  ) {
    const existingYears = existing.map(
      (budgetRecord) => budgetRecord.fiscalYear.value
    );
    const budgetRecordsToBeCreated = expected.filter(
      (year) => !existingYears.includes(year)
    );
    const budgetId = await this.getBudgetIdForPartnership(partnership);
    const organizationId = await this.getOrganizationIdByPartnership(
      partnership
    );

    const budgetRecords = budgetRecordsToBeCreated.map((year) => ({
      budgetId: budgetId,
      organizationId: organizationId,
      fiscalYear: year,
    }));
    await Promise.all(
      budgetRecords.map((record) => this.budgets.createRecord(record, session))
    );
  }

  private async deactivateOldBudgetRecords(
    session: ISession,
    existing: readonly BudgetRecord[],
    expected: number[]
  ) {
    // TODO: validate that record.fiscalYear.value cannot be undefined
    const budgetRecoredsToBeDeactivated = existing.filter(
      (record) => !expected.includes(record.fiscalYear.value!)
    );

    await Promise.all(
      budgetRecoredsToBeDeactivated.map((record) =>
        this.budgets.deleteRecord(record.id, session)
      )
    );
  }

  private async synchronizePartnershipBudgetRecords(
    partnership: Partnership,
    session: ISession
  ) {
    const expectedBudgetRecordYears = this.calculateExpectedBudgetRecordYears(
      partnership
    );
    // in cases where the expected budget years array is empty you could optimize by skipping some queries
    const existingBudgetRecordYears = await this.getExistingBudgetRecordYearsForPartnership(
      partnership,
      session
    );
    await this.createMissingBudgetRecords(
      partnership,
      session,
      existingBudgetRecordYears,
      expectedBudgetRecordYears
    );
    await this.deactivateOldBudgetRecords(
      session,
      existingBudgetRecordYears,
      expectedBudgetRecordYears
    );
  }

  async handle(event: SubscribedEvent) {
    this.logger.debug('Partnership/Project mutation, syncing budget records', {
      ...event,
      event: event.constructor.name,
    });

    try {
      if (event instanceof PartnershipUpdatedEvent) {
        await this.synchronizePartnershipBudgetRecords(
          event.partnership,
          event.session
        );
      }

      if (event instanceof PartnershipCreatedEvent) {
        await this.synchronizePartnershipBudgetRecords(
          event.partnership,
          event.session
        );
      }

      if (event instanceof PartnershipDeletedEvent) {
        const expectedBudgetRecordYears: number[] = [];
        const existingBudgetRecordYears = await this.getExistingBudgetRecordYearsForPartnership(
          event.partnership,
          event.session
        );
        await this.deactivateOldBudgetRecords(
          event.session,
          existingBudgetRecordYears,
          expectedBudgetRecordYears
        );
      }

      if (event instanceof ProjectUpdatedEvent) {
        const partnerships = await this.getPartnershipsForProject(
          event.updated,
          event.session
        );

        await Promise.all(
          partnerships.map((partnership) =>
            this.synchronizePartnershipBudgetRecords(partnership, event.session)
          )
        );
      }
    } catch (exception) {
      this.logger.error(`Could not synchronize budget records`, {
        userId: event.session.userId,
        exception,
      });
      throw new ServerException(
        'Could not synchronize budget records',
        exception
      );
    }

    // TODO: only continue if budget is pending
    // TODO: Fiscal years may need to be determined from project. See #596 for details
  }
}
