import { Role } from '../dto';

export class RoleChangeEvent {
  constructor(
    readonly userId: string,
    readonly baseNodeId: string,
    readonly role: Role
  ) {}
}
