import { type UnsecuredDto } from '~/common';
import { type FieldRegion, type UpdateFieldRegion } from '../dto';

export class FieldRegionUpdatedEvent {
  constructor(
    readonly previous: UnsecuredDto<FieldRegion>,
    readonly updated: UnsecuredDto<FieldRegion>,
    readonly input: UpdateFieldRegion,
  ) {}
}
