import { Session } from '~/common';
import { Partnership } from '../dto';

export class PartnershipWillDeleteEvent {
  constructor(readonly partnership: Partnership, readonly session: Session) {}
}
