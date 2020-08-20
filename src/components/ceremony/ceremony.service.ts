import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { ISession } from '../../common';
import {
  addAllSecureProperties,
  addBaseNodeMetaPropsWithClause,
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  listWithSecureObject,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  Property,
  runListQuery,
} from '../../core';
import {
  Ceremony,
  CeremonyListInput,
  CeremonyListOutput,
  CreateCeremony,
  UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('ceremony:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    return [
      [
        node('newCeremony'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, 'Property', {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
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
        node('newCeremony'),
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
        node('newCeremony'),
      ],
    ];
  };

  propMatch = (property: string) => {
    const perm = 'canRead' + upperFirst(property);
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('ceremony'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async create(input: CreateCeremony, session: ISession): Promise<Ceremony> {
    const secureProps: Property[] = [
      {
        key: 'type',
        value: input.type,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'planned',
        value: input.planned,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'estimatedDate',
        value: input.estimatedDate,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'actualDate',
        value: input.actualDate,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    try {
      const query = this.db
        .query()
        .call(matchRequestingUser, session)
        .match([
          node('root', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ])
        .call(createBaseNode, 'Ceremony', secureProps, {
          owningOrgId: session.owningOrgId,
        })
        .return('node.id as id');

      const result = await query.first();

      if (!result) {
        throw new ServerException('failed to create a budget');
      }

      return await this.readOne(result.id, session);
    } catch (e) {
      this.logger.warning('Failed to create ceremony', {
        exception: e,
      });

      throw e;
    }
  }

  async readOne(id: string, session: ISession): Promise<Ceremony> {
    this.logger.info(`Query readOne Ceremony`, { id, userId: session.userId });
    if (!id) {
      throw new BadRequestException('No ceremony id to search for');
    }
    const baseNodeMetaProps = ['id', 'createdAt'];
    const secureProps = ['type', 'planned', 'estimatedDate', 'actualDate'];
    const readCeremony = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'Ceremony', id)
      .call(addAllSecureProperties, ...secureProps)
      .return(
        `
          {
            ${addBaseNodeMetaPropsWithClause(baseNodeMetaProps)},
            ${listWithSecureObject(secureProps)}
          } as ceremony
        `
      );

    const result = await readCeremony.first();

    if (!result) {
      throw new NotFoundException('Could not find ceremony');
    }

    return {
      id: result.ceremony.id,
      createdAt: result.ceremony.createdAt,
      type: result.ceremony.type.value,
      planned: result.ceremony.planned,
      estimatedDate: result.ceremony.estimatedDate,
      actualDate: result.ceremony.actualDate,
    };
  }

  async update(input: UpdateCeremony, session: ISession): Promise<Ceremony> {
    const object = await this.readOne(input.id, session);

    return await this.db.sgUpdateProperties({
      session,
      object,
      props: ['planned', 'estimatedDate', 'actualDate'],
      changes: input,
      nodevar: 'ceremony',
    });
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find ceremony');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete ceremony', {
        exception: e,
      });
      throw e;
    }
  }

  async list(
    { filter, ...input }: CeremonyListInput,
    session: ISession
  ): Promise<CeremonyListOutput> {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Ceremony', { active: true })]);

    const listResult: {
      items: Array<{
        identity: string;
        labels: string[];
        properties: Ceremony;
      }>;
      hasMore: boolean;
      total: number;
    } = await runListQuery(query, input);

    const items = await Promise.all(
      listResult.items.map((item) => {
        return this.readOne(item.properties.id, session);
      })
    );

    return {
      items,
      hasMore: listResult.hasMore,
      total: listResult.total,
    };
  }

  async checkCeremonyConsistency(session: ISession): Promise<boolean> {
    const ceremonies = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('ceremony', 'Ceremony', {
            active: true,
          }),
        ],
      ])
      .return('ceremony.id as id')
      .run();

    return (
      await Promise.all(
        ceremonies.map(async (ceremony) => {
          return await this.db.hasProperties({
            session,
            id: ceremony.id,
            props: ['type'],
            nodevar: 'ceremony',
          });
        })
      )
    ).every((n) => n);
  }
}
