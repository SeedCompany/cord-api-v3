import { Session } from '../../../common';
import { UpdateUser, User } from '../dto';

export class UserUpdatedEvent {
  constructor(
    public updated: User,
    readonly previous: User,
    readonly updates: UpdateUser,
    readonly session: Session
  ) {}
}
