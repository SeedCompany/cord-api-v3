import { difference } from 'lodash';
import { UnreachableCaseError } from 'ts-essentials';
import {
  DuplicateException,
  fiscalYears,
  ID,
  Secured,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { PartnerType } from '../../partner';
import { PartnershipService } from '../../partnership';
import { Partnership } from '../../partnership/dto';
import {
  PartnershipCreatedEvent,
  PartnershipUpdatedEvent,
  PartnershipWillDeleteEvent,
} from '../../partnership/events';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetRepository } from '../budget.repository';
import { BudgetService } from '../budget.service';
import { Budget, BudgetRecord } from '../dto';

type PartialBudget = UnsecuredDto<Pick<Budget, 'id' | 'status'>> & {
  records: ReadonlyArray<UnsecuredDto<BudgetRecord>>;
};

type SubscribedEvent =
  | ProjectUpdatedEvent
  | PartnershipCreatedEvent
  | PartnershipUpdatedEvent
  | PartnershipWillDeleteEvent;

@EventsHandler(
  ProjectUpdatedEvent,
  PartnershipCreatedEvent,
  PartnershipUpdatedEvent,
  PartnershipWillDeleteEvent,
)
export class SyncBudgetRecordsToFundingPartners
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly budgets: BudgetService,
    private readonly budgetRepo: BudgetRepository,
    private readonly partnershipService: PartnershipService,
    @Logger('budget:sync-partnerships') private readonly logger: ILogger,
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Partnership/Project mutation, syncing budget records', {
      ...event,
      event: event.constructor.name,
    });

    // Get some easy conditions out of the way that don't require DB queries
    if (
      event instanceof PartnershipCreatedEvent &&
      !isFunding(event.partnership)
    ) {
      // Partnership is not and never was funding, so do nothing.
      return;
    }
    if (
      event instanceof PartnershipWillDeleteEvent &&
      !isFunding(event.partnership)
    ) {
      // Partnership was not funding, so do nothing.
      return;
    }

    const projectId = await this.determineProjectId(event);
    const changeset = await this.determineChangeset(event);

    // Fetch budget & only continue if it is pending
    const budget = await this.budgetRepo.listRecordsForSync(
      projectId,
      event.session,
      changeset,
    );

    const partnerships = await this.determinePartnerships(event, changeset);

    for (const partnership of partnerships) {
      await this.syncRecords(budget, partnership, event, changeset);
    }
  }

  private async determineProjectId(event: SubscribedEvent) {
    if (event instanceof ProjectUpdatedEvent) {
      return event.updated.id;
    }
    if (event instanceof PartnershipUpdatedEvent) {
      return event.updated.project.id;
    }
    return event.partnership.project.id;
  }

  private async determineChangeset(event: SubscribedEvent) {
    if (event instanceof ProjectUpdatedEvent) {
      return event.updated.changeset;
    }
    if (event instanceof PartnershipCreatedEvent) {
      return event.partnership.changeset;
    }
    if (event instanceof PartnershipUpdatedEvent) {
      return event.updated.changeset;
    }
    if (event instanceof PartnershipWillDeleteEvent) {
      return event.partnership.changeset;
    }
    throw new UnreachableCaseError(event);
  }

  private async determinePartnerships(event: SubscribedEvent, changeset?: ID) {
    if (event instanceof PartnershipCreatedEvent) {
      return [event.partnership];
    }

    if (event instanceof PartnershipUpdatedEvent) {
      return [event.updated];
    }

    if (event instanceof PartnershipWillDeleteEvent) {
      return [event.partnership];
    }

    // event instanceof ProjectUpdatedEvent
    const list = await this.partnershipService.list(
      { filter: { projectId: event.updated.id } },
      event.session,
      changeset,
    );
    return list.items.filter(isFunding);
  }

  private async syncRecords(
    budget: PartialBudget,
    partnership: Partnership,
    event: SubscribedEvent,
    changeset?: ID,
  ) {
    const organizationId = partnership.organization.id;

    const previous = budget.records
      .filter((record) => record.organization === organizationId)
      .map((record) => record.fiscalYear);
    const updated =
      event instanceof PartnershipWillDeleteEvent
        ? []
        : partnershipFiscalYears(partnership);

    const removals = difference(previous, updated);
    const additions = difference(updated, previous);

    await this.removeRecords(
      budget,
      organizationId,
      removals,
      event.session,
      changeset,
    );
    await this.addRecords(
      budget,
      organizationId,
      additions,
      event.session,
      changeset,
    );
  }

  private async addRecords(
    budget: PartialBudget,
    organizationId: ID,
    additions: readonly FiscalYear[],
    session: Session,
    changeset?: ID,
  ) {
    await Promise.all(
      additions.map((fiscalYear) =>
        this.budgets
          .createRecord(
            {
              budgetId: budget.id,
              fiscalYear,
              organizationId,
            },
            session,
            changeset,
          )
          .catch((e) => {
            if (e instanceof DuplicateException) {
              // If this record already exists, this user probably just doesn't
              // have permission to see it yet. Ignore and move on.
              return;
            }
            throw e;
          }),
      ),
    );
  }

  private async removeRecords(
    budget: PartialBudget,
    organizationId: ID,
    removals: readonly FiscalYear[],
    session: Session,
    changeset?: ID,
  ) {
    const recordsToDelete = budget.records.filter(
      (record) =>
        record.organization === organizationId &&
        removals.includes(record.fiscalYear),
    );

    await Promise.all(
      recordsToDelete.map((record) =>
        this.budgets.deleteRecord(record.id, session, changeset),
      ),
    );
  }
}

const isFunding = (partnership: Partnership) =>
  readSecured(partnership.types, `partnership's types`).includes(
    PartnerType.Funding,
  );

type FiscalYear = number;

const partnershipFiscalYears = (
  partnership: Partnership,
): readonly FiscalYear[] => {
  if (!isFunding(partnership)) {
    return [];
  }

  const start = readSecured(
    partnership.mouStart,
    `partnership's mouStart date`,
  );
  const end = readSecured(partnership.mouEnd, `partnership's mouEnd date`);
  return start && end ? fiscalYears(start, end) : [];
};

const readSecured = <T extends Secured<any>>(
  field: T,
  errorMessage: string,
): Exclude<T['value'], undefined> => {
  if (!field.canRead) {
    throw new UnauthorizedException(
      `Current user cannot read ${errorMessage} thus record sync cannot continue`,
    );
  }
  return field.value;
};
