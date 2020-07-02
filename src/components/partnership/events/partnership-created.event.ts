import { ISession } from '../../../common';
import { Partnership } from '../dto';

export class PartnershipCreatedEvent {
  constructor(readonly partnership: Partnership, readonly session: ISession) {}
}
