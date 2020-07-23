import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { PartnershipType } from '../../partnership/dto';
import {
  PartnershipCreatedEvent,
  PartnershipDeletedEvent,
  PartnershipUpdatedEvent,
} from '../../partnership/events';
import { ProjectUpdatedEvent } from '../../project/events';
import { BudgetService } from '../budget.service';

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
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Partnership/Project mutation, syncing budget records', {
      ...event,
      event: event.constructor.name,
    });

    if (
      event instanceof PartnershipCreatedEvent &&
      !event.partnership.types?.value
    ) {
      // Partnership Type is not provided, so do nothing.
      return;
    }
    if (
      event instanceof PartnershipCreatedEvent &&
      !event.partnership.types.value.includes(PartnershipType.Funding)
    ) {
      // Partnership is not and never was funding, so do nothing.
      return;
    }

    // TODO only continue if budget is pending
    // TODO if partnership is deleted or no longer funding, then remove budget records
    // TODO else if partnership is funding, then add budget records for its fiscal years.
    // Fiscal years may need to be determined from project. See #596 for details
  }
}
