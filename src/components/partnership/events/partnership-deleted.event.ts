import { ISession } from '../../../common';
import { Partnership } from '../dto';

export class PartnershipDeletedEvent {
  constructor(readonly partnership: Partnership, readonly session: ISession) {}
}
