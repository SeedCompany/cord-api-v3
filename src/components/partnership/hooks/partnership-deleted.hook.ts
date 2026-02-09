import { type Partnership } from '../dto';

export class PartnershipWillDeleteHook {
  constructor(readonly partnership: Partnership) {}
}
