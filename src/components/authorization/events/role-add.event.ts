import { InternalRole, Role } from '../dto';

export class RoleAddEvent {
  constructor(
    readonly userId: string,
    readonly baseNodeId: string,
    readonly role: Role & InternalRole
  ) {}
}
