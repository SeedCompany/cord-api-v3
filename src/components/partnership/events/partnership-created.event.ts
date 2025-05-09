import { type Session } from '~/common';
import { type Partnership } from '../dto';

export class PartnershipCreatedEvent {
  constructor(readonly partnership: Partnership, readonly session: Session) {}
}
