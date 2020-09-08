import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import {
  InputException,
  ISession,
  NotFoundException,
  ServerException,
  UnauthenticatedException,
} from '../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  getPermList,
  getPropList,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import {
  Ceremony,
  CeremonyListInput,
  CeremonyListOutput,
  CreateCeremony,
  UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyService {
  private readonly securedProperties = {
    type: true,
    planned: true,
    estimatedDate: true,
    actualDate: true,
  };

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
    } catch (exception) {
      this.logger.warning('Failed to create ceremony', {
        exception,
      });

      throw exception;
    }
  }

  async readOne(id: string, session: ISession): Promise<Ceremony> {
    this.logger.debug(`Query readOne Ceremony`, { id, userId: session.userId });
    if (!id) {
      throw new InputException('No ceremony id to search for', 'ceremony.id');
    }
    const readCeremony = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Ceremony', { active: true, id })])
      .call(getPermList, 'requestingUser')
      .call(getPropList, 'permList')
      .return('node, permList, propList')
      .asResult<StandardReadResult<DbPropsOfDto<Ceremony>>>();

    const result = await readCeremony.first();

    if (!result) {
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    const securedProps = parseSecuredProperties(
      result.propList,
      result.permList,
      this.securedProperties
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...securedProps,
      type: securedProps.type.value!,
    };
  }

  async update(input: UpdateCeremony, session: ISession): Promise<Ceremony> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }
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
      throw new NotFoundException('Could not find ceremony', 'ceremony.id');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (exception) {
      this.logger.warning('Failed to delete ceremony', {
        exception,
      });
      throw exception;
    }
  }

  async list(
    { filter, ...input }: CeremonyListInput,
    session: ISession
  ): Promise<CeremonyListOutput> {
    const label = 'Ceremony';
    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.type
          ? [
              relation('out', '', 'type', { active: true }),
              node('name', 'Property', { active: true, value: filter.type }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property', { active: true }),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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
