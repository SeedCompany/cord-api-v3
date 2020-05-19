import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
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
        node('sg', 'SecurityGroup', { active: true }),
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

  async readOne(id: string, session: ISession): Promise<Ceremony> {
    this.logger.info(`Query readOne Ceremony`, { id, userId: session.userId });
    if (!id) {
      throw new BadRequestException('No ceremony id to search for');
    }
    const readCeremony = await this.db
      .query()
      .match(matchSession(session))
      .match([node('ceremony', 'Ceremony', { active: true, id })])
      .optionalMatch([...this.propMatch('type')])
      .optionalMatch([...this.propMatch('planned')])
      .optionalMatch([...this.propMatch('estimatedDate')])
      .optionalMatch([...this.propMatch('actualDate')])
      .return({
        ceremony: [{ id: 'id', createdAt: 'createdAt' }],
        type: [{ value: 'type' }],
        canReadType: [{ read: 'canReadType', edit: 'canEditType' }],
        planned: [{ value: 'planned' }],
        canReadPlanned: [{ read: 'canReadPlanned', edit: 'canEditPlanned' }],
        estimatedDate: [{ value: 'estimatedDate' }],
        canReadEstimatedDate: [
          { read: 'canReadEstimatedDate', edit: 'canEditEstimatedDate' },
        ],
        actualDate: [{ value: 'actualDate' }],
        canReadActualDate: [
          { read: 'canReadActualDate', edit: 'canEditActualDate' },
        ],
      })
      .first();

    if (!readCeremony) {
      throw new NotFoundException('Could not find ceremony');
    }

    return {
      id,
      createdAt: readCeremony.createdAt,
      type: readCeremony.type,
      planned: {
        value: !!readCeremony.planned,
        canRead: !!readCeremony.canReadPlanned,
        canEdit: !!readCeremony.canEditPlanned,
      },
      estimatedDate: {
        value: readCeremony.estimatedDate,
        canRead: !!readCeremony.canReadEstimatedDate,
        canEdit: !!readCeremony.canEditEstimatedDate,
      },
      actualDate: {
        value: readCeremony.actualDate,
        canRead: !!readCeremony.canReadActualDate,
        canEdit: !!readCeremony.canEditActualDate,
      },
    };
  }

  async list(
    { page, count, sort, order, filter }: CeremonyListInput,
    session: ISession
  ): Promise<CeremonyListOutput> {
    const result = await this.db.list<Ceremony>({
      session,
      nodevar: 'ceremony',
      aclReadProp: 'canReadCeremonies',
      aclEditProp: 'canCreateCeremony',
      props: [
        { name: 'type', secure: false },
        { name: 'planned', secure: true },
        { name: 'estimatedDate', secure: true },
        { name: 'actualDate', secure: true },
      ],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }

  async create(input: CreateCeremony, session: ISession): Promise<Ceremony> {
    const id = generate();
    const createdAt = DateTime.local();

    try {
      await this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateCeremony' }))
        .create([
          [
            node('newCeremony', 'Ceremony:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('type', input.type),
          ...this.permission('planned'),
          ...this.permission('estimatedDate'),
          ...this.permission('actualDate'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.type + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.type + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('type'),
          ...this.permission('planned'),
          ...this.permission('estimatedDate'),
          ...this.permission('actualDate'),
        ])
        .return('newCeremony.id as id')
        .first();

      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning('Failed to create ceremony', {
        exception: e,
      });

      throw e;
    }
  }

  async update(input: UpdateCeremony, session: ISession): Promise<Ceremony> {
    const object = await this.readOne(input.id, session);

    return this.db.sgUpdateProperties({
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
          return this.db.hasProperties({
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
