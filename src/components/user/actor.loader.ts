import { ID } from '~/common';
import { LoaderFactory, SessionAwareLoaderStrategy } from '~/core';
import { Actor } from './dto';
import { UserService } from './user.service';

@LoaderFactory(() => Actor)
export class ActorLoader extends SessionAwareLoaderStrategy<Actor> {
  constructor(private readonly users: UserService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.users.readManyActors(ids, this.session);
  }
}
