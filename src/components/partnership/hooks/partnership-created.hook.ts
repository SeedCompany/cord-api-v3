import { type Partnership } from '../dto';

export class PartnershipCreatedHook {
  constructor(readonly partnership: Partnership) {}
}
