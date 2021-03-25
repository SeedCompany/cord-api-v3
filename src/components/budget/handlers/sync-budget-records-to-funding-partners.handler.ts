import { node, relation } from 'cypher-query-builder';
import { difference } from 'lodash';
import {
  DuplicateException,
  fiscalYears,
  ID,
  NotFoundException,
  Secured,
  Session,
  UnauthorizedException,
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
import { ProjectService } from '../../project';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';
import { Budget, BudgetRecord, BudgetStatus } from '../dto';

type SubscribedEvent =
  | ProjectUpdatedEvent
  | PartnershipCreatedEvent
  | PartnershipUpdatedEvent
  | PartnershipWillDeleteEvent;

@EventsHandler(
  ProjectUpdatedEvent,
  PartnershipCreatedEvent,
  PartnershipUpdatedEvent,
  PartnershipWillDeleteEvent
)
export class SyncBudgetRecordsToFundingPartners
  implements IEventHandler<SubscribedEvent> {
  constructor(
    private readonly db: DatabaseService,
    private readonly budgets: BudgetService,
    private readonly partnershipService: PartnershipService,
    private readonly projects: ProjectService,
    @Logger('budget:sync-partnerships') private readonly logger: ILogger
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

    // Fetch budget & only continue if it is pending
    const projectsCurrentBudget = await this.projects.currentBudget(
      projectId,
      event.session
    );
    const budget = readSecured(projectsCurrentBudget, 'budget');
    if (budget?.status !== BudgetStatus.Pending) {
      this.logger.debug('Budget is not pending, skipping sync', budget);
      return;
    }

    const partnerships = await this.determinePartnerships(event);

    for (const partnership of partnerships) {
      await this.syncRecords(budget, partnership, event);
    }
  }

  private async determineProjectId(event: SubscribedEvent) {
    if (event instanceof ProjectUpdatedEvent) {
      return event.updated.id;
    }
    if (event instanceof PartnershipUpdatedEvent) {
      return await this.getProjectIdFromPartnership(event.updated);
    }
    return await this.getProjectIdFromPartnership(event.partnership);
  }

  private async determinePartnerships(event: SubscribedEvent) {
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
      event.session
    );
    return list.items.filter(isFunding);
  }

  private async syncRecords(
    budget: Budget,
    partnership: Partnership,
    event: SubscribedEvent
  ) {
    const organizationId = await this.getOrganizationIdByPartnership(
      partnership
    );

    const previous = budget.records
      .filter((record) => recordOrganization(record) === organizationId)
      .map(recordFiscalYear);
    const updated =
      event instanceof PartnershipWillDeleteEvent
        ? []
        : partnershipFiscalYears(partnership);

    const removals = difference(previous, updated);
    const additions = difference(updated, previous);

    await this.removeRecords(budget, organizationId, removals, event.session);
    await this.addRecords(budget, organizationId, additions, event.session);
  }

  private async addRecords(
    budget: Budget,
    organizationId: ID,
    additions: readonly FiscalYear[],
    session: Session
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
            session
          )
          .catch((e) => {
            if (e instanceof DuplicateException) {
              // If this record already exists, this user probably just doesn't
              // have permission to see it yet. Ignore and move on.
              return;
            }
            throw e;
          })
      )
    );
  }

  private async removeRecords(
    budget: Budget,
    organizationId: ID,
    removals: readonly FiscalYear[],
    session: Session
  ) {
    const recordsToDelete = budget.records.filter(
      (record) =>
        recordOrganization(record) === organizationId &&
        removals.includes(recordFiscalYear(record))
    );

    await Promise.all(
      recordsToDelete.map((record) =>
        this.budgets.deleteRecord(record.id, session)
      )
    );
  }

  private async getOrganizationIdByPartnership(partnership: Partnership) {
    const partnerId = readSecured(partnership.partner, `partnership's partner`);

    const result = await this.db
      .query()
      .match([
        node('partner', 'Partner', { id: partnerId }),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization'),
      ])
      .return('organization.id as id')
      .asResult<{ id: ID }>()
      .first();
    if (!result) {
      throw new NotFoundException("Could not find partner's organization");
    }

    return result.id;
  }

  private async getProjectIdFromPartnership({ id }: Partnership) {
    const result = await this.db
      .query()
      .match([
        node('', 'Partnership', { id }),
        relation('either', '', 'partnership', { active: true }),
        node('project', 'Project'),
      ])
      .return('project.id as id')
      .asResult<{ id: ID }>()
      .first();
    if (!result) {
      throw new NotFoundException("Unable to find partnership's project");
    }
    return result.id;
  }
}

const isFunding = (partnership: Partnership) =>
  readSecured(partnership.types, `partnership's types`).includes(
    PartnerType.Funding
  );

type FiscalYear = number;

const partnershipFiscalYears = (
  partnership: Partnership
): readonly FiscalYear[] => {
  if (!isFunding(partnership)) {
    return [];
  }

  const start = readSecured(
    partnership.mouStart,
    `partnership's mouStart date`
  );
  const end = readSecured(partnership.mouEnd, `partnership's mouEnd date`);
  return start && end ? fiscalYears(start, end) : [];
};

const recordOrganization = (record: BudgetRecord) =>
  readSecured(record.organization, `budget record's organization`);

const recordFiscalYear = (record: BudgetRecord) =>
  readSecured(record.fiscalYear, `budget record's fiscal year`);

const readSecured = <T extends Secured<any>>(
  field: T,
  errorMessage: string
): Exclude<T['value'], undefined> => {
  if (!field.canRead) {
    throw new UnauthorizedException(
      `Current user cannot read ${errorMessage} thus record sync cannot continue`
    );
  }
  return field.value;
};
