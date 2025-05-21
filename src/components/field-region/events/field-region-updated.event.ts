import { type UnsecuredDto } from '~/common';
import { type FieldRegion, type UpdateFieldRegion } from '../dto';

export class FieldRegionUpdatedEvent {
  constructor(
    readonly updated: UnsecuredDto<FieldRegion>,
    readonly previous: UnsecuredDto<FieldRegion>,
    readonly input: UpdateFieldRegion,
  ) {}
}
