import { type Partnership, type UpdatePartnership } from '../dto';

export class PartnershipUpdatedHook {
  constructor(
    public updated: Partnership,
    readonly previous: Partnership,
    readonly updates: UpdatePartnership,
  ) {}
}
