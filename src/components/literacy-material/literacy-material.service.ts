import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { DuplicateException, ISession } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import {
  CreateLiteracyMaterial,
  LiteracyMaterial,
  LiteracyMaterialListInput,
  LiteracyMaterialListOutput,
  UpdateLiteracyMaterial,
} from './dto';
@Injectable()
export class LiteracyMaterialService {
  constructor(
    @Logger('literacyMaterial:service') private readonly logger: ILogger,
    private readonly db: DatabaseService,
    private readonly config: ConfigService
  ) {}

  @OnIndex()
  async createIndexes() {
    const constraints = [
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.createdAt)',
      'CREATE CONSTRAINT ON (n:LiteracyMaterial) ASSERT EXISTS(n.owningOrgId)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:LiteracyName) ASSERT n.value IS UNIQUE',
    ];
    for (const query of constraints) {
      await this.db.query().raw(query).run();
    }
  }

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel =
      prop === 'name' ? 'Property:LiteracyName' : 'Property:Range';
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining permissions
  permission = (property: string, baseNode: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };

  async create(
    input: CreateLiteracyMaterial,
    session: ISession
  ): Promise<LiteracyMaterial> {
    const checkLiteracy = await this.db
      .query()
      .raw(
        `
        MATCH(literacyMaterial:LiteracyName {value: $name}) return literacyMaterial
        `,
        {
          name: input.name,
        }
      )
      .first();

    if (checkLiteracy) {
      throw new DuplicateException(
        'literacyMaterial.name',
        'Literacy with this name already exists'
      );
    }
    const id = generate();
    const createdAt = DateTime.local();
    try {
      const query = this.db
        .query()
        .match(
          matchSession(session, { withAclEdit: 'canCreateLiteracyMaterial' })
        )
        .match([
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node(
              'newLiteracyMaterial',
              ['LiteracyMaterial', 'Producible', 'BaseNode'],
              {
                active: true,
                createdAt,
                id,
                owningOrgId: session.owningOrgId,
              }
            ),
          ],
          ...this.property('name', input.name, 'newLiteracyMaterial'),
          [
            node('adminSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              id: generate(),
              active: true,
              createdAt,
              name: input.name + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('adminSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          [
            node('readerSG'),
            relation('out', '', 'member', { active: true, createdAt }),
            node('rootuser'),
          ],
          ...this.permission('name', 'newLiteracyMaterial'),
          ...this.permission('range', 'newLiteracyMaterial'),
          // TODO scriptureReferences
        ])
        .return(
          'newLiteracyMaterial.id as id, requestingUser.canCreateLiteracyMaterial as canCreateLiteracyMaterial'
        );
      await query.first();
    } catch (err) {
      this.logger.error(
        `Could not create literacyMaterial for user ${session.userId}`
      );
      throw new ServerException('Could not create literacyMaterial');
    }
    this.logger.info(`literacyMaterial created`, { id });
    return this.readOne(id, session);
  }

  async readOne(
    literacyMaterialId: string,
    session: ISession
  ): Promise<LiteracyMaterial> {
    const readLiteracy = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canReadLiteracyMaterials' }))
      .match([
        node('literacyMaterial', 'LiteracyMaterial', {
          active: true,
          id: literacyMaterialId,
        }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadRange', 'Permission', {
          property: 'range',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('literacyMaterial'),
        relation('out', '', 'name', { active: true }),
        node('name', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditRange', 'Permission', {
          property: 'range',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('literacyMaterial'),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadName', 'Permission', {
          property: 'name',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('literacyMaterial'),
        relation('out', '', 'range', { active: true }),
        node('rangeNode', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canEditName', 'Permission', {
          property: 'name',
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('literacyMaterial'),
      ])
      .return({
        literacyMaterial: [{ id: 'id', createdAt: 'createdAt' }],
        name: [{ value: 'name' }],
        requestingUser: [
          {
            canReadLiteracyMaterials: 'canReadLiteracyMaterials',
            canCreateLiteracyMaterial: 'canCreateLiteracyMaterial',
          },
        ],
        canReadName: [{ read: 'canReadName' }],
        canEditName: [{ edit: 'canEditName' }],
        rangeNode: [{ value: 'range' }],
        canReadRange: [{ read: 'canReadRange' }],
        canEditRange: [{ edit: 'canEditRange' }],
      });

    let result;
    try {
      result = await readLiteracy.first();
    } catch {
      throw new ServerException('Read LiteracyMaterial Error');
    }
    if (!result) {
      throw new NotFoundException('Could not find literacyMaterial');
    }
    if (!result.canReadLiteracyMaterials) {
      throw new ForbiddenException(
        'User does not have permission to read a literacyMaterial'
      );
    }
    return {
      id: result.id,
      name: {
        value: result.name,
        canRead: !!result.canReadName,
        canEdit: !!result.canEditName,
      },
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
      createdAt: result.createdAt,
    };
  }

  async update(
    input: UpdateLiteracyMaterial,
    session: ISession
  ): Promise<LiteracyMaterial> {
    const literacyMaterial = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
      session,
      object: literacyMaterial,
      props: ['name'], // TODO scriptureReferences
      changes: input,
      nodevar: 'literacyMaterial',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const literacyMaterial = await this.readOne(id, session);
    try {
      await this.db.deleteNode({
        session,
        object: literacyMaterial,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.error('Failed to delete', { id, exception: e });
      throw new ServerException('Failed to delete');
    }

    this.logger.info(`deleted literacyMaterial with id`, { id });
  }

  async list(
    { page, count, sort, order, filter }: LiteracyMaterialListInput,
    session: ISession
  ): Promise<LiteracyMaterialListOutput> {
    const result = await this.db.list<LiteracyMaterial>({
      session,
      nodevar: 'literacyMaterial',
      aclReadProp: 'canReadLiteracyMaterials',
      aclEditProp: 'canCreateLiteracyMaterial',
      props: ['name'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });
    const items = result.items.length
      ? await Promise.all(
          result.items.map(async (r) => {
            return this.readOne(r.id, session);
          })
        )
      : [];

    return {
      items: (items as unknown) as LiteracyMaterial[],
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
