import { ID } from '../../common';
import { LoaderFactory, OrderedNestDataLoader } from '../../core';
import { User } from './dto';
import { UserService } from './user.service';

@LoaderFactory(() => User)
export class UserLoader extends OrderedNestDataLoader<User> {
  constructor(private readonly users: UserService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.users.readMany(ids, this.session);
  }
}
