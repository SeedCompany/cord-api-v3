import { Injectable } from '@nestjs/common';
import { ID, NotImplementedException, PublicOf } from '~/common';
import { disableAccessPolicies, e, RepoFor, ScopeOf } from '~/core/gel';
import {
  AssignOrganizationToUser,
  RemoveOrganizationFromUser,
  User,
  UserListInput,
} from './dto';
import type { UserRepository } from './user.repository';

export const hydrateUser = e.shape(e.User, (user) => ({
  ...user['*'],
  __typename: e.str('User'),
}));
const hydrateSystemAgent = e.shape(e.SystemAgent, (agent) => ({
  ...agent['*'],
  __typename: e.str('SystemAgent'),
}));

@Injectable()
export class UserGelRepository
  extends RepoFor(User, { hydrate: hydrateUser })
  implements PublicOf<UserRepository>
{
  async readManyActors(ids: readonly ID[]) {
    const res = await this.db.run(this.readManyActorsQuery, { ids });
    return [...res.users, ...res.agents];
  }
  private readonly readManyActorsQuery = e.params(
    { ids: e.array(e.uuid) },
    ({ ids }) => {
      const actors = e.cast(e.Actor, e.array_unpack(ids));
      return e.select({
        users: e.select(actors.is(e.User), hydrateUser),
        agents: e.select(actors.is(e.SystemAgent), hydrateSystemAgent),
      });
    },
  );

  async doesEmailAddressExist(email: string) {
    const query = e.select(e.User, () => ({
      filter_single: { email },
    }));
    const result = await this.db.withOptions(disableAccessPolicies).run(query);
    return !!result;
  }

  getUserByEmailAddress(email: string) {
    const query = e.select(e.User, (user) => ({
      ...this.hydrate(user),
      filter_single: { email },
    }));

    return this.db.run(query);
  }

  protected listFilters(user: ScopeOf<typeof e.User>, input: UserListInput) {
    if (!input.filter) return [];
    return [
      input.filter.pinned != null &&
        e.op(user.pinned, '=', input.filter.pinned),
      // More filters here when needed...
    ];
  }

  assignOrganizationToUser(args: AssignOrganizationToUser): Promise<void> {
    throw new NotImplementedException().with(args);
  }
  removeOrganizationFromUser(args: RemoveOrganizationFromUser): Promise<void> {
    throw new NotImplementedException().with(args);
  }

  hydrateAsNeo4j(): never {
    throw new NotImplementedException();
  }
}
