import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { PartnershipType, Partnership } from '../../partnership/dto';
import {
  PartnershipCreatedEvent,
  PartnershipDeletedEvent,
  PartnershipUpdatedEvent,
} from '../../partnership/events';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';
import { BudgetRecord } from '../dto';
import { ISession } from '../../../common';
import {
  InternalServerErrorException as ServerException,
} from '@nestjs/common';

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
    @Logger('budget:sync-partnerships') private readonly logger: ILogger
  ) { }

  // TODO: refactor into budget service or partnership service
  private async getBudgetIdForPartnership(partnership: Partnership) {
    let budgets = await this.db.query()
      .raw('MATCH (:Partnership { id: $partnershipId })-[:partnership]-(el)-[:budget]-(budget:Budget)', { partnershipId: partnership.id })
      .return('budget.id')
      .run();

    // TODO: determine if the business logic should allow for more then one budget per partnership
    return budgets[0]["budget.id"]
  }

  private async getExistingBudgetRecordYearsForPartnership(partnership: Partnership, session: ISession) {
    let budgetId = await this.getBudgetIdForPartnership(partnership);
    let budget = await this.budgets.readOne(budgetId, session);

    return budget.records
  }

  private calculateExpectedBudgetRecordYears(partnership: Partnership) {
    let expectedBudgetRecordYears: number[]
    if (!partnership.mouStart?.value ||
      !partnership.mouEnd?.value ||
      // TODO: decide whether to move the following funding and type checks to an earlier step.
      !partnership.types.value.includes(PartnershipType.Funding) || // Partnership is not funding, so do nothing
      !partnership.types?.value // Partnership Type is not provided, so do nothing.
    ) {

      expectedBudgetRecordYears = [];
    } else {
      // TODO: mous starting at midnight on Jan 1st might cause issues with UTC vs local issues here.
      // double check how year should be calculated
      let mouStartYear = partnership.mouStart.value!.year;
      let mouEndYear = partnership.mouEnd.value!.year;

      expectedBudgetRecordYears = Array.from({ length: (mouEndYear - mouStartYear) }, (v, k) => k + mouStartYear);
    }
    return expectedBudgetRecordYears
  }

  private async getOrganizationIdByPartnership(partnership: Partnership) {
    // TODO: refactor so that partnership.organization.id returns a value instead of undefined.
    // this is currently a workaround because of the partnership.organization.id returning undefined.
    let organization = await this.db.query()
      .raw('MATCH (:Partnership { id: $partnershipId })-[:organization]-(organization:Organization)', { partnershipId: partnership.id })
      .return('organization.id')
      .run();

    // TODO: determine if the business logic should allow for more then one budget per partnership
    return organization[0]["organization.id"]
  }

  private async createMissingBudgetRecords(partnership: Partnership, session: ISession, existing: readonly BudgetRecord[], expected: number[]) {
    let existingYears = existing.map(budgetRecord => budgetRecord.fiscalYear.value)
    let budgetRecordsToBeCreated = expected.filter(year => !existingYears.includes(year))
    let budgetId = await this.getBudgetIdForPartnership(partnership);
    let organizationId = await this.getOrganizationIdByPartnership(partnership);

    const budgetRecords = budgetRecordsToBeCreated.map(year => ({
      budgetId: budgetId,
      organizationId: organizationId,
      fiscalYear: year
    }));
    await Promise.all(
      budgetRecords.map((record) =>
        this.budgets.createRecord(record, session)
      )
    );
  }

  private async deactivateOldBudgetRecords(partnership: Partnership, session: ISession, existing: readonly BudgetRecord[], expected: number[]) {
    // TODO: validate that record.fiscalYear.value cannot be undefined
    let budgetRecoredsToBeDeactivated = existing.filter(record => !expected.includes(record.fiscalYear.value!))

    await Promise.all(
      budgetRecoredsToBeDeactivated.map((record) =>
        this.budgets.deleteRecord(record.id, session)
      )
    );
  }

  async handle(event: SubscribedEvent) {
    this.logger.debug('Partnership/Project mutation, syncing budget records', {
      ...event,
      event: event.constructor.name,
    });

    if (event instanceof (PartnershipUpdatedEvent || PartnershipCreatedEvent)) {
      try {
        let expectedBudgetRecordYears = this.calculateExpectedBudgetRecordYears(event.partnership)
        // in cases where the expected budget years array is empty you could optimize by skipping some queries
        let existingBudgetRecordYears = await this.getExistingBudgetRecordYearsForPartnership(event.partnership, event.session);
        this.createMissingBudgetRecords(event.partnership, event.session, existingBudgetRecordYears, expectedBudgetRecordYears);
        this.deactivateOldBudgetRecords(event.partnership, event.session, existingBudgetRecordYears, expectedBudgetRecordYears);
      } catch (exception) {
        this.logger.error(`Could not synchronize budget records`, {
          userId: event.session.userId,
          exception,
        });
        throw new ServerException('Could not synchronize budget records');
      }
    }

    if (event instanceof PartnershipDeletedEvent) {
      try {
        let expectedBudgetRecordYears: number[] = []
        let existingBudgetRecordYears = await this.getExistingBudgetRecordYearsForPartnership(event.partnership, event.session);
        this.deactivateOldBudgetRecords(event.partnership, event.session, existingBudgetRecordYears, expectedBudgetRecordYears);
      } catch (exception) {
        this.logger.error(`Could not synchronize budget records`, {
          userId: event.session.userId,
          exception,
        });
        throw new ServerException('Could not synchronize budget records');
      }
    }

    if (event instanceof ProjectUpdatedEvent) {
      // TODO: implement on project update
      // updates will effect every partnership
    }

    // TODO: only continue if budget is pending
    // TODO: Fiscal years may need to be determined from project. See #596 for details
  }
}