import { type Partnership } from '../dto';

export class PartnershipWillDeleteEvent {
  constructor(readonly partnership: Partnership) {}
}
