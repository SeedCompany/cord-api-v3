import { Injectable } from '@nestjs/common';
import { NotImplementedException, PublicOf } from '~/common';
import { e, RepoFor, ScopeOf } from '~/core/edgedb';
import {
  AssignOrganizationToUser,
  RemoveOrganizationFromUser,
  User,
  UserListInput,
} from './dto';
import type { UserRepository } from './user.repository';

@Injectable()
export class UserEdgeDBRepository
  extends RepoFor(User, {
    hydrate: (user) => user['*'],
  }).withDefaults()
  implements PublicOf<UserRepository>
{
  async doesEmailAddressExist(email: string) {
    const query = e.select(e.User, () => ({
      filter_single: { email },
    }));
    const result = await this.db.run(query);
    return !!result;
  }

  protected listFilters(user: ScopeOf<typeof e.User>, input: UserListInput) {
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

  hydrateAsNeo4j(_session: unknown): any {
    throw new NotImplementedException();
  }
}
