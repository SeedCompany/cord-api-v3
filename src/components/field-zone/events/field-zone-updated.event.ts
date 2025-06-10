import { type UnsecuredDto } from '~/common';
import { type FieldZone, type UpdateFieldZone } from '../dto';

export class FieldZoneUpdatedEvent {
  constructor(
    readonly previous: UnsecuredDto<FieldZone>,
    readonly updated: UnsecuredDto<FieldZone>,
    readonly input: UpdateFieldZone,
  ) {}
}
