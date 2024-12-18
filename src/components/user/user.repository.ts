import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  Role,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DtoRepository, OnIndex, UniquenessError } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createProperty,
  deactivateProperty,
  defineSorters,
  filter,
  FullTextIndex,
  matchProps,
  merge,
  paginate,
  path,
  property,
  requestingUser,
  sortWith,
} from '~/core/database/query';
import {
  AssignOrganizationToUser,
  CreatePerson,
  RemoveOrganizationFromUser,
  SystemAgent,
  UpdateUser,
  User,
  UserFilters,
  UserListInput,
} from './dto';

@Injectable()
export class UserRepository extends DtoRepository<typeof User, [Session | ID]>(
  User,
) {
  async readManyActors(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .raw('', { ids })
      .matchNode('user', 'User')
      .where({ 'user.id': inArray('$ids', true) })
      .with('user as node')
      .apply(this.hydrate(session))
      .union()
      .matchNode('agent', 'SystemAgent')
      .where({ 'agent.id': inArray('$ids', true) })
      .return<{ dto: UnsecuredDto<User | SystemAgent> }>(
        merge('agent', {
          __typename: '"SystemAgent"',
        }).as('dto'),
      )
      .map('dto')
      .run();
  }

  private readonly roleProperties = (roles?: readonly Role[]) =>
    (roles || []).flatMap((role) =>
      property('roles', role, 'node', `role${role}`),
    );

  async create(input: CreatePerson) {
    const initialProps = {
      ...(input.email ? { email: input.email } : {}), // omit email prop/relation if it's undefined
      realFirstName: input.realFirstName,
      realLastName: input.realLastName,
      displayFirstName: input.displayFirstName,
      displayLastName: input.displayLastName,
      phone: input.phone,
      timezone: input.timezone,
      about: input.about,
      status: input.status,
      title: input.title,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(await createNode(User, { initialProps }))
      .apply((q) =>
        input.roles && input.roles.length > 0
          ? q.create([...this.roleProperties(input.roles)])
          : q,
      )
      .return<{ id: ID }>('node.id as id');
    let result;
    try {
      result = await query.first();
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'EmailAddress') {
        throw new DuplicateException(
          'person.email',
          'Email address is already in use',
          e,
        );
      }
      throw new ServerException('Failed to create user', e);
    }
    if (!result) {
      throw new ServerException('Failed to create user');
    }
    return result;
  }

  async update(changes: UpdateUser) {
    const { id, roles, email, ...simpleChanges } = changes;

    await this.updateProperties({ id }, simpleChanges);
    if (email !== undefined) {
      await this.updateEmail(id, email);
    }
    if (roles) {
      await this.updateRoles(id, roles);
    }

    return await this.readOne(id, id);
  }

  protected hydrate(requestingUserId: Session | ID) {
    return (query: Query) =>
      query
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'roles', ACTIVE),
              node('role', 'Property'),
            ])
            .return('collect(role.value) as roles'),
        )
        .apply(matchProps())
        .match(requestingUser(requestingUserId))
        .return<{ dto: UnsecuredDto<User> }>(
          merge({ email: null }, 'props', {
            __typename: '"User"',
            roles: 'roles',
            pinned: 'exists((requestingUser)-[:pinned]->(node))',
          }).as('dto'),
        );
  }

  private async updateEmail(
    id: ID,
    email: string | null | undefined,
  ): Promise<void> {
    const query = this.db
      .query()
      .matchNode('node', 'User', { id })
      .apply(deactivateProperty({ resource: User, key: 'email' }))
      .apply((q) =>
        email
          ? q.apply(
              createProperty({ resource: User, key: 'email', value: email }),
            )
          : q,
      )
      .return('*');
    try {
      await query.run();
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'EmailAddress') {
        throw new DuplicateException(
          'person.email',
          'Email address is already in use',
          e,
        );
      }
      throw e;
    }
  }

  private async updateRoles(id: ID, roles: readonly Role[]): Promise<void> {
    const { roles: existingRoles } = await this.readOne(id, id);
    const removals = difference(existingRoles, roles);
    const additions = difference(roles, existingRoles);

    if (removals.length > 0) {
      await this.db
        .query()
        .match([
          node('user', ['User', 'BaseNode'], { id }),
          relation('out', 'oldRoleRel', 'roles', ACTIVE),
          node('oldRoles', 'Property'),
        ])
        .where({
          oldRoles: {
            value: inArray(removals),
          },
        })
        .set({
          values: {
            'oldRoleRel.active': false,
          },
        })
        .run();
    }

    if (additions.length > 0) {
      await this.db
        .query()
        .match([node('node', ['User', 'BaseNode'], { id })])
        .create([...this.roleProperties(additions)])
        .run();
    }
  }

  async delete(id: ID, session: Session, object: User): Promise<void> {
    const user = await this.readOne(id, session);
    this.privileges.forUser(session, user).verifyCan('delete');
    try {
      await this.db.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: UserListInput, session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'User')
      .match(requestingUser(session))
      .apply(userFilters(input.filter))
      .apply(this.privileges.forUser(session).filterToReadable())
      .apply(sortWith(userSorters, input))
      .apply(paginate(input, this.hydrate(session.userId)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async doesEmailAddressExist(email: string) {
    const result = await this.db
      .query()
      .matchNode('email', 'EmailAddress', { value: email })
      .return('email.value')
      .first();
    return !!result;
  }

  async getUserByEmailAddress(email: string, session: Session) {
    const query = this.db
      .query()
      .matchNode('node', 'User')
      .where(
        path([
          node('node'),
          relation('out', '', 'email', ACTIVE),
          node({
            value: email,
          }),
        ]),
      )
      .apply(this.privileges.forUser(session).filterToReadable())
      .apply(this.hydrate(session));

    const result = await query.first();
    return result?.dto ?? null;
  }

  async assignOrganizationToUser({
    userId,
    orgId,
    primary,
  }: AssignOrganizationToUser) {
    await this.db
      .query()
      .match([
        [node('user', 'User', { id: userId })],
        [node('org', 'Organization', { id: orgId })],
      ])
      .subQuery((sub) =>
        sub
          .with('user, org')
          .match([
            node('user'),
            relation('out', 'oldRel', 'organization', ACTIVE),
            node('org'),
          ])
          .setValues({ 'oldRel.active': false })
          .return('oldRel')
          .union()
          .return('null as oldRel'),
      )
      .apply((q) => {
        if (primary) {
          q.subQuery((sub) =>
            sub
              .with('user, org')
              .match([
                node('user'),
                relation('out', 'oldRel', 'primaryOrganization', {
                  active: true,
                }),
                node('org'),
              ])
              .setValues({ 'oldRel.active': false })
              .return('oldRel as oldPrimaryRel')
              .union()
              .return('null as oldPrimaryRel'),
          );
        }
      })
      .return('oldRel')
      .run();

    const userToOrg = (label: string) => [
      node('user'),
      relation('out', '', label, {
        active: true,
        createdAt: DateTime.local(),
      }),
      node('org'),
    ];
    const result = await this.db
      .query()
      .match([
        [node('org', 'Organization', { id: orgId })],
        [node('user', 'User', { id: userId })],
      ])
      .create([
        userToOrg('organization'),
        ...(primary ? [userToOrg('primaryOrganization')] : []),
      ])
      .return('org.id')
      .first();
    if (!result) {
      throw new ServerException('Failed to assign organization to user');
    }
  }

  async removeOrganizationFromUser(request: RemoveOrganizationFromUser) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User', {
          id: request.userId,
        }),
        relation('out', 'oldRel', 'organization', {
          active: true,
        }),
        node('org', 'Organization', {
          id: request.orgId,
        }),
      ])
      .optionalMatch([
        node('user'),
        relation('out', 'primary', 'primaryOrganization', ACTIVE),
        node('org'),
      ])
      .setValues({ 'oldRel.active': false })
      .return({ oldRel: [{ id: 'oldId' }], primary: [{ id: 'primaryId' }] })
      .asResult<{ primaryId: ID; oldId: ID }>()
      .first();

    // TODO Refactor this into one query and make these two relationships independent or combine into one.
    if (result?.primaryId) {
      const removePrimary = this.db
        .query()
        .match([
          node('user', 'User', {
            id: request.userId,
          }),
          relation('out', 'oldRel', 'primaryOrganization', {
            active: true,
          }),
          node('primaryOrg', 'Organization', {
            id: request.orgId,
          }),
        ])
        .setValues({ 'oldRel.active': false })
        .return('oldRel');
      await removePrimary.first();
    }
  }

  hydrateAsNeo4j(session: Session | ID) {
    return this.hydrate(session);
  }

  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(NameIndex.create()).run();
  }
}

export const userFilters = filter.define(() => UserFilters, {
  pinned: filter.isPinned,
  name: filter.fullText({
    index: () => NameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'User'),
        relation('out', '', undefined, ACTIVE),
        node('match'),
      ]),
    // Treat each word as a separate search term
    // Each word could point to a different node
    // i.e. "first last"
    separateQueryForEachWord: true,
    minScore: 0.9,
  }),
});

export const userSorters = defineSorters(User, {});

const NameIndex = FullTextIndex({
  indexName: 'UserName',
  labels: 'UserName',
  properties: 'value',
  analyzer: 'standard-folding',
});
