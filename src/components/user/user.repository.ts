import { Injectable } from '@nestjs/common';
import { inArray, node, type Query, relation } from 'cypher-query-builder';
import { difference } from 'lodash';
import { DateTime } from 'luxon';
import {
  CreationFailed,
  DuplicateException,
  generateId,
  type ID,
  type Role,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { Identity } from '~/core/authentication';
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
  multiPropsAsSortString,
  paginate,
  path,
  pinned,
  property,
  type SortCol,
  sortWith,
} from '~/core/database/query';
import { FileService } from '../file';
import { type FileId } from '../file/dto';
import {
  type AssignOrganizationToUser,
  type CreatePerson,
  type RemoveOrganizationFromUser,
  type SystemAgent,
  type UpdateUser,
  User,
  UserFilters,
  type UserListInput,
} from './dto';

@Injectable()
export class UserRepository extends DtoRepository(User) {
  constructor(
    private readonly files: FileService,
    private readonly identity: Identity,
  ) {
    super();
  }
  async readManyActors(ids: readonly ID[]) {
    return await this.db
      .query()
      .raw('', { ids })
      .matchNode('user', 'User')
      .where({ 'user.id': inArray('$ids', true) })
      .with('user as node')
      .apply(this.hydrate())
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
    const photoId = await generateId<FileId>();

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
      gender: input.gender,
      photo: photoId,
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
      throw new CreationFailed(User, { cause: e });
    }
    if (!result) {
      throw new CreationFailed(User);
    }

    // User creates their own photo file.
    await this.identity.asUser(result.id, async () => {
      await this.files.createDefinedFile(
        photoId,
        'Photo',
        result.id,
        'photo',
        input.photo,
        'user.photo',
        true,
      );
    });

    return result;
  }

  async update(changes: UpdateUser) {
    const { id, roles, email, photo, ...simpleChanges } = changes;

    await this.updateProperties({ id }, simpleChanges);
    if (email !== undefined) {
      await this.updateEmail(id, email);
    }
    if (roles) {
      await this.updateRoles(id, roles);
    }

    if (photo !== undefined) {
      const person = await this.readOne(id);

      if (!person.photo) {
        throw new ServerException(
          'Expected photo file to be updated with this person',
        );
      }

      await this.files.createFileVersion({
        ...photo,
        parent: person.photo.id,
      });
    }

    return await this.readOne(id);
  }

  protected hydrate() {
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
        .return<{ dto: UnsecuredDto<User> }>(
          merge({ email: null }, 'props', {
            __typename: '"User"',
            photo: { id: 'props.photo' },
            roles: 'roles',
            pinned,
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
    const { roles: existingRoles } = await this.readOne(id);
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

  async delete(id: ID, object: User): Promise<void> {
    const user = await this.readOne(id);
    this.privileges.forContext(user).verifyCan('delete');
    try {
      await this.deleteNode(object, { resource: User });
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: UserListInput) {
    const result = await this.db
      .query()
      .matchNode('node', 'User')
      .apply(userFilters(input.filter))
      .apply(this.privileges.filterToReadable())
      .apply(sortWith(userSorters, input))
      .apply(paginate(input, this.hydrate()))
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

  async getUserByEmailAddress(email: string) {
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
      .apply(this.privileges.filterToReadable())
      .apply(this.hydrate());

    const result = await query.first();
    return result?.dto ?? null;
  }

  async assignOrganizationToUser({
    user,
    org,
    primary,
  }: AssignOrganizationToUser) {
    await this.db
      .query()
      .match([
        [node('user', 'User', { id: user })],
        [node('org', 'Organization', { id: org })],
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
              .with('user')
              .match([
                node('user'),
                relation('out', 'oldRel', 'primaryOrganization', {
                  active: true,
                }),
                node('anyOrg', 'Organization'),
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
        [node('org', 'Organization', { id: org })],
        [node('user', 'User', { id: user })],
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

  async getPrimaryOrganizationId(userId: ID): Promise<ID | null> {
    const result = await this.db
      .query()
      .match([
        node('user', 'User', { id: userId }),
        relation('out', '', 'primaryOrganization', ACTIVE),
        node('org', 'Organization'),
      ])
      .return<{ orgId: ID }>('org.id as orgId')
      .first();

    return result?.orgId ?? null;
  }

  async removeOrganizationFromUser(request: RemoveOrganizationFromUser) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User', {
          id: request.user,
        }),
        relation('out', 'oldRel', 'organization', {
          active: true,
        }),
        node('org', 'Organization', {
          id: request.org,
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
            id: request.user,
          }),
          relation('out', 'oldRel', 'primaryOrganization', {
            active: true,
          }),
          node('primaryOrg', 'Organization', {
            id: request.org,
          }),
        ])
        .setValues({ 'oldRel.active': false })
        .return('oldRel');
      await removePrimary.first();
    }
  }

  hydrateAsNeo4j() {
    return this.hydrate();
  }

  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(NameIndex.create()).run();
  }
}

export const userFilters = filter.define(() => UserFilters, {
  id: filter.baseNodeProp(),
  pinned: filter.isPinned,
  status: filter.propVal(),
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
  title: filter.propPartialVal(),
  roles: filter.stringListProp(),
});

export const userSorters = defineSorters(User, {
  fullName: (query) =>
    query
      .match([
        node('node'),
        relation('out', '', 'realFirstName', ACTIVE),
        node('firstName'),
      ])
      .match([
        node('node'),
        relation('out', '', 'realLastName', ACTIVE),
        node('lastName'),
      ])
      .return<SortCol>(multiPropsAsSortString('firstName', 'lastName')),
});

const NameIndex = FullTextIndex({
  indexName: 'UserName',
  labels: 'UserName',
  properties: 'value',
  analyzer: 'standard-folding',
});
