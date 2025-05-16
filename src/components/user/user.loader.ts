import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { User } from './dto';
import { UserService } from './user.service';

@LoaderFactory(() => User)
export class UserLoader implements DataLoaderStrategy<User, ID<User>> {
  constructor(private readonly users: UserService) {}

  async loadMany(ids: ReadonlyArray<ID<User>>) {
    return await this.users.readMany(ids);
  }
}
