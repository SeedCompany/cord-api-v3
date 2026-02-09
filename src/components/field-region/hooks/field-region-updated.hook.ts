import { type UnsecuredDto } from '~/common';
import { type FieldRegion, type UpdateFieldRegion } from '../dto';

export class FieldRegionUpdatedHook {
  constructor(
    readonly previous: UnsecuredDto<FieldRegion>,
    readonly updated: UnsecuredDto<FieldRegion>,
    readonly input: UpdateFieldRegion,
  ) {}
}
