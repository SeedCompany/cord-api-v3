import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ConditionalKeys } from 'type-fest';
import {
  CalendarDate,
  DuplicateException,
  ID,
  NotFoundException,
  Order,
  Role,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '~/common';
import { e, EdgeDb, isExclusivityViolation } from '~/core/edgedb';
import { User as DbUser } from '~/core/edgedb/schema';
import { CreatePerson, User, UserListInput } from './dto';
import { UserRepository } from './user.repository';

const hydrate = e.shape(e.User, (user) => ({
  ...user['*'],
  // Other links if needed
}));

@Injectable()
export class UserEdgedbRepository extends UserRepository {
  constructor(private readonly edgedb: EdgeDb) {
    super();
  }

  async readOne(id: ID, _session: Session | ID) {
    const query = e.select(e.User, (user) => ({
      ...hydrate(user),
      filter_single: { id },
    }));
    const user = await query.run(this.edgedb);
    if (!user) {
      throw new NotFoundException('Could not find user');
    }
    return user as UnsecuredDto<User>;
  }

  async readMany(ids: readonly ID[], _session: Session | ID) {
    const query = e.params({ ids: e.array(e.uuid) }, ({ ids }) =>
      e.select(e.User, (user) => ({
        ...hydrate(user),
        filter: e.op(user.id, 'in', e.array_unpack(ids)),
      })),
    );
    const users = await query.run(this.edgedb, { ids });
    return users as Array<UnsecuredDto<User>>;
  }

  async doesEmailAddressExist(email: string) {
    const query = e.select(e.User, () => ({
      filter_single: { email },
    }));
    const result = await query.run(this.edgedb);
    return !!result;
  }

  async list(input: UserListInput, _session: Session) {
    const sort = input.sort as Exclude<
      ConditionalKeys<DbUser, string | number | DateTime | CalendarDate>,
      'status'
    > &
      string;
    const query = e.select(e.User, (user) => ({
      ...hydrate(user),
      // TODO filters
      // TODO privileges filters
      order_by: {
        expression: user[sort],
        direction: input.order === Order.ASC ? e.ASC : e.DESC,
      },
      // TODO pagination
    }));
    const items = await query.run(this.edgedb);
    return {
      items: items as Array<UnsecuredDto<User>>,
      total: items.length,
      hasMore: false,
    };
  }

  async create(input: CreatePerson) {
    const query = e.insert(e.User, { ...input });
    try {
      const result = await query.run(this.edgedb);
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
    const query = e.update(e.User, () => ({
      filter_single: { id: user.id },
      set: { email },
    }));
    try {
      await query.run(this.edgedb);
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
    const query = e.update(e.User, () => ({
      filter_single: { id: user.id },
      set: { roles },
    }));
    await query.run(this.edgedb);
  }

  async delete(id: ID, session: Session, _object: User): Promise<void> {
    const canDelete = await this.db.checkDeletePermission(id, session);
    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this User',
      );
    const query = e.delete(e.User, () => ({
      filter_single: { id },
    }));
    try {
      await query.run(this.edgedb);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }
}
