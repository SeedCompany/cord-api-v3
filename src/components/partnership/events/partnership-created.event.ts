import { type Partnership } from '../dto';

export class PartnershipCreatedEvent {
  constructor(readonly partnership: Partnership) {}
}
