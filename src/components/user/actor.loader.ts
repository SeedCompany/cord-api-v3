import { type ID } from '~/common';
import { type DataLoaderStrategy, LoaderFactory } from '~/core/data-loader';
import { Actor } from './dto';
import { UserService } from './user.service';

@LoaderFactory(() => Actor)
export class ActorLoader implements DataLoaderStrategy<Actor, ID<Actor>> {
  constructor(private readonly users: UserService) {}

  async loadMany(ids: ReadonlyArray<ID<Actor>>) {
    return await this.users.readManyActors(ids);
  }
}
