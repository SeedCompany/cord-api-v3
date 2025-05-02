import { type Session } from '~/common';
import { type Partnership } from '../dto';

export class PartnershipWillDeleteEvent {
  constructor(readonly partnership: Partnership, readonly session: Session) {}
}
