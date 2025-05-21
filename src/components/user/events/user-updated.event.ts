import { type UnsecuredDto } from '~/common';
import { type UpdateUser, type User } from '../dto';

export class UserUpdatedEvent {
  constructor(
    readonly updated: UnsecuredDto<User>,
    readonly previous: UnsecuredDto<User>,
    readonly input: UpdateUser,
  ) {}
}
