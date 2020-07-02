import { ISession } from '../../../common';
import { Partnership, UpdatePartnership } from '../dto';

export class PartnershipUpdatedEvent {
  constructor(
    readonly partnership: Partnership,
    readonly updates: UpdatePartnership,
    readonly session: ISession
  ) {}
}
