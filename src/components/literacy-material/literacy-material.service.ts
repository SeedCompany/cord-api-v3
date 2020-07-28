import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { DuplicateException, ISession } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  addPropertyCoalesceWithClause,
  addUserToSG,
  ConfigService,
  createBaseNode,
  createSG,
  DatabaseService,
  filterByString,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchUserPermissions,
  OnIndex,
  Property,
  runListQuery,
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

    // create literacy-material
    const secureProps: Property[] = [
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'LiteracyName',
      },
    ];

    const query = this.db
      .query()
      .match([
        node('root', 'User', { active: true, id: this.config.rootAdmin.id }),
      ])
      .match([
        node('publicSG', 'PublicSecurityGroup', {
          active: true,
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .call(matchRequestingUser, session)
      .call(createSG, 'orgSG', 'OrgPublicSecurityGroup')
      .call(createBaseNode, 'LiteracyMaterial:Producible', secureProps, {
        owningOrgId: session.owningOrgId,
      })
      // TODO scriptureReferences
      .call(addUserToSG, 'requestingUser', 'adminSG') // must come after base node creation
      .return('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('failed to create default literacyMaterial');
    }

    const id = result.id;

    // add root admin to new literacyMaterial as an admin
    await this.db.addRootAdminToBaseNodeAsAdmin(id, 'LiteracyMaterial');

    this.logger.debug(`literacyMaterial created`, { id });

    return this.readOne(id, session);
  }

  async readOne(
    literacyMaterialId: string,
    session: ISession
  ): Promise<LiteracyMaterial> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const props = ['name', 'range'];
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'LiteracyMaterial', literacyMaterialId)
      .call(addAllSecureProperties, ...props)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        'coalesce(node.id) as id',
        'coalesce(node.createdAt) as createdAt',
      ])
      .returnDistinct([...props, 'id', 'createdAt']);

    const result = (await query.first()) as LiteracyMaterial | undefined;
    if (!result) {
      throw new NotFoundException('Could not find org');
    }

    return {
      ...result,
      scriptureReferences: {
        // TODO
        canRead: true,
        canEdit: true,
        value: [],
      },
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
    { filter, ...input }: LiteracyMaterialListInput,
    session: ISession
  ): Promise<LiteracyMaterialListOutput> {
    const label = 'LiteracyMaterial';
    const baseNodeMetaProps = ['id', 'createdAt'];
    const secureProps = ['name'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, label);

    if (filter.name) {
      query.call(filterByString, label, 'name', filter.name);
    }

    // match on the rest of the properties of the object requested
    query.call(addAllSecureProperties, ...secureProps).with(
      `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)}
          } as node
        `
    );

    const result: LiteracyMaterialListOutput = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );
    const items = result.items.map((row: any) => {
      return {
        ...row,
        scriptureReferences: {
          // TODO
          canRead: true,
          canEdit: true,
          value: [],
        },
      };
    });

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
}
