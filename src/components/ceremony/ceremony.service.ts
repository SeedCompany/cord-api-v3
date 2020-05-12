import { Injectable, NotFoundException } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
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

  async readOne(id: string, session: ISession): Promise<Ceremony> {
    const result = await this.db.readProperties({
      session,
      id,
      nodevar: 'ceremony',
      aclReadNode: 'canReadCeremonies',
      props: [
        'id',
        'createdAt',
        'type',
        'planned',
        'estimatedDate',
        'actualDate',
      ],
    });

    if (!result) {
      throw new NotFoundException('Could not find ceremony');
    }

    return {
      id,
      createdAt: result.createdAt.value,
      type: result.type.value,
      planned: result.planned,
      estimatedDate: result.estimatedDate,
      actualDate: result.actualDate,
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

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    // const propLabel = prop === 'name' ? 'Property:OrgName' : 'Property';
    return [
      [
        node(baseNode),
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
  permission = (
    property: string,
    sg: string,
    baseNode: string,
    read: boolean,
    edit: boolean
  ) => {
    const createdAt = DateTime.local();
    return [
      [
        node(sg),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read,
          edit,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };
  async create(input: CreateCeremony, session: ISession): Promise<Ceremony> {
    const id = generate();
    const createdAt = DateTime.local();

    try {
      await this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreateCeremony' }))
        .create([
          [
            node('ceremony', 'Ceremony:BaseNode', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('type', input.type, 'ceremony'),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.type + ' admin',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('type', 'adminSG', 'ceremony', true, true),
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: input.type + ' users',
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('type', 'readerSG', 'ceremony', true, false),
        ])
        .return('ceremony.id as id')
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

    return this.db.updateProperties({
      session,
      object,
      props: ['type', 'planned', 'estimatedDate', 'actualDate'],
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
