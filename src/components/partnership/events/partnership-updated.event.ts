import { Session } from '../../../common';
import { Partnership, UpdatePartnership } from '../dto';

export class PartnershipUpdatedEvent {
  constructor(
    public updated: Partnership,
    readonly previous: Partnership,
    readonly updates: UpdatePartnership,
    readonly session: Session,
  ) {}
}
