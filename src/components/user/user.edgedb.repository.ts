import { Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  Role,
  ServerException,
  Session,
} from '~/common';
import { e, EdgeDB, isExclusivityViolation } from '~/core/edgedb';
import { CreatePerson, User, UserListInput } from './dto';
import { UserRepository } from './user.repository';

const hydrate = e.shape(e.default.User, (user) => ({
  ...user['*'],
  // Other links if needed
}));

@Injectable()
export class UserEdgedbRepository extends UserRepository {
  constructor(private readonly edgedb: EdgeDB) {
    super();
  }

  async readOne(id: ID, _session: Session | ID) {
    const query = e.select(e.default.User, (user) => ({
      ...hydrate(user),
      filter_single: { id },
    }));
    const user = await this.edgedb.run(query);
    if (!user) {
      throw new NotFoundException('Could not find user');
    }
    return user;
  }

  async readMany(ids: readonly ID[], _session: Session | ID) {
    const query = e.params({ ids: e.array(e.uuid) }, ({ ids }) =>
      e.select(e.default.User, (user) => ({
        ...hydrate(user),
        filter: e.op(user.id, 'in', e.array_unpack(ids)),
      })),
    );
    const users = await this.edgedb.run(query, { ids });
    return users;
  }

  async doesEmailAddressExist(email: string) {
    const query = e.select(e.default.User, () => ({
      filter_single: { email },
    }));
    const result = await this.edgedb.run(query);
    return !!result;
  }

  async list(input: UserListInput, _session: Session) {
    const sortKey = input.sort as keyof (typeof e.default.User)['*'];
    const all = e.select(e.default.User, (user) => ({
      filter: e.all(
        input.filter.pinned != null
          ? e.op(user.pinned, '=', input.filter.pinned)
          : true,
        // More filters here when needed...
      ),
      order_by: {
        expression: user[sortKey],
        direction: input.order,
      },
    }));
    const thisPage = e.select(all, () => ({
      offset: (input.page - 1) * input.count,
      limit: input.count + 1,
    }));
    const query = e.select({
      items: e.select(thisPage, (user) => ({
        ...hydrate(user),
        limit: input.count,
      })),
      total: e.count(all),
      hasMore: e.op(e.count(thisPage), '>', input.count),
    });
    return await this.edgedb.run(query);
  }

  async create(input: CreatePerson) {
    const query = e.insert(e.default.User, { ...input });
    try {
      const result = await this.edgedb.run(query);
      return result.id;
    } catch (e) {
      if (isExclusivityViolation(e, 'email')) {
        throw new DuplicateException(
          'person.email',
          'Email address is already in use',
          e,
        );
      }
      throw new ServerException('Failed to create user', e);
    }
  }

  async updateEmail(
    user: User,
    email: string | null | undefined,
  ): Promise<void> {
    const query = e.update(e.default.User, () => ({
      filter_single: { id: user.id },
      set: { email },
    }));
    try {
      await this.edgedb.run(query);
    } catch (e) {
      if (isExclusivityViolation(e, 'email')) {
        throw new DuplicateException(
          'person.email',
          'Email address is already in use',
          e,
        );
      }
      throw e;
    }
  }

  async updateRoles(user: User, roles: Role[]): Promise<void> {
    const query = e.update(e.default.User, () => ({
      filter_single: { id: user.id },
      set: { roles },
    }));
    await this.edgedb.run(query);
  }

  async delete(id: ID, _session: Session, _object: User): Promise<void> {
    const query = e.delete(e.default.User, () => ({
      filter_single: { id },
    }));
    try {
      await this.edgedb.run(query);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }
}
