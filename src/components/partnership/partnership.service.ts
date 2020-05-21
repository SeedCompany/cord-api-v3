import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger, matchSession } from '../../core';
import {
  CreatePartnership,
  Partnership,
  PartnershipListInput,
  PartnershipListOutput,
  UpdatePartnership,
} from './dto';

@Injectable()
export class PartnershipService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('partnership:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const propLabel = 'Property';
    return [
      [
        node('newPartnership'),
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
        node('newPartnership'),
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
        node('newPartnership'),
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
        node('partnership'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async create(
    { organizationId, projectId, ...input }: CreatePartnership,
    session: ISession
  ): Promise<Partnership> {
    const id = generate();
    const createdAt = DateTime.local();

    try {
      const createPartnership = this.db
        .query()
        .match(matchSession(session, { withAclEdit: 'canCreatePartnership' }))
        .create([
          [
            node('newPartnership', 'Partnership', {
              active: true,
              createdAt,
              id,
              owningOrgId: session.owningOrgId,
            }),
          ],
          ...this.property('agreementStatus', input.agreementStatus),
          ...this.property('mouStatus', input.mouStatus),
          ...this.property('mouStart', input.mouStart),
          ...this.property('mouEnd', input.mouEnd),
          ...this.property('types', input.types),
          [
            node('adminSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: `${input.mouStart} ${input.mouEnd} admin`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          [
            node('readerSG', 'SecurityGroup', {
              active: true,
              createdAt,
              name: `${input.mouStart} ${input.mouEnd} users`,
            }),
            relation('out', '', 'member', { active: true, createdAt }),
            node('requestingUser'),
          ],
          ...this.permission('agreementStatus'),
          ...this.permission('mouStatus'),
          ...this.permission('mouStart'),
          ...this.permission('mouEnd'),
          ...this.permission('types'),
          ...this.permission('organization'),
        ])
        .return('newPartnership.id as id');

      try {
        await createPartnership.first();
      } catch (e) {
        this.logger.error('e :>> ', e);
      }

      // connect the Organization to the Partnership
      // and connect Partnership to Project
      const query = `
        MATCH (organization:Organization {id: $organizationId, active: true}),
          (partnership:Partnership {id: $id, active: true}),
          (project:Project {id: $projectId, active: true})
        CREATE (project)-[:partnership {active: true, createdAt: datetime()}]->(partnership)
                  -[:organization {active: true, createdAt: datetime()}]->(organization)
        RETURN partnership.id as id
      `;

      await this.db
        .query()
        .raw(query, {
          organizationId,
          id,
          projectId,
        })
        .first();
      return await this.readOne(id, session);
    } catch (e) {
      this.logger.warning('Failed to create partnership', {
        exception: e,
      });

      throw new ServerException('Failed to create partnership');
    }
  }

  async readOne(id: string, session: ISession): Promise<Partnership> {
    const readPartnership = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadPartnerships' }))
      .match([node('partnership', 'Partnership', { active: true, id })])
      .optionalMatch([...this.propMatch('agreementStatus')])
      .optionalMatch([...this.propMatch('mouStatus')])
      .optionalMatch([...this.propMatch('mouStart')])
      .optionalMatch([...this.propMatch('mouEnd')])
      .optionalMatch([...this.propMatch('types')])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadOrganization', 'Permission', {
          property: 'organization',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),
        relation('out', '', 'organization', { active: true }),
        node('organization', 'Organization', { active: true }),
        relation('out', '', 'name', { active: true }),
        node('organizationName', 'Property', { active: true }),
      ])

      .return({
        partnership: [{ id: 'id', createdAt: 'createdAt' }],
        agreementStatus: [{ value: 'agreementStatus' }],
        canReadAgreementStatus: [
          {
            read: 'canReadAgreementStatusRead',
            edit: 'canReadAgreementStatusEdit',
          },
        ],
        mouStatus: [{ value: 'mouStatus' }],
        canReadMouStatus: [
          { read: 'canReadMouStatusRead', edit: 'canReadMouStatusEdit' },
        ],
        mouStart: [{ value: 'mouStart' }],
        canReadMouStart: [
          {
            read: 'canReadMouStartRead',
            edit: 'canReadMouStartEdit',
          },
        ],
        mouEnd: [{ value: 'mouEnd' }],
        canReadMouEnd: [
          {
            read: 'canReadMouEndRead',
            edit: 'canReadMouEndEdit',
          },
        ],
        organization: [
          { id: 'organizationId', createdAt: 'organizationCreatedAt' },
        ],
        organizationName: [{ value: 'organizationName' }],
        canReadOrganization: [
          {
            read: 'canReadOrganizationRead',
            edit: 'canReadOrganizationEdit',
          },
        ],
        types: [{ value: 'types' }],
        canReadTypes: [
          {
            read: 'canReadTypesRead',
            edit: 'canReadTypesEdit',
          },
        ],
      });

    let result;
    try {
      result = await readPartnership.first();
    } catch (e) {
      this.logger.error('e :>> ', e);
    }

    if (!result) {
      throw new NotFoundException('Could not find partnership');
    }

    return {
      id,
      createdAt: result.createdAt,
      agreementStatus: {
        value: result.agreementStatus,
        canRead: !!result.canReadAgreementStatus,
        canEdit: !!result.canEditAgreementStatus,
      },
      mouStatus: {
        value: result.mouStatus,
        canRead: !!result.canReadMouStatus,
        canEdit: !!result.canEditMouStatus,
      },
      mouStart: {
        value: result.mouStart,
        canRead: !!result.canReadMouStart,
        canEdit: !!result.canEditMouStart,
      },
      mouEnd: {
        value: result.mouEnd,
        canRead: !!result.canReadMouEnd,
        canEdit: !!result.canEditMouEnd,
      },
      types: {
        value: result.types ?? [],
        canRead: !!result.canReadTypes,
        canEdit: !!result.canEditTypes,
      },
      organization: {
        id: result.organizationId,
        createdAt: result.organizationCreatedAt,
        name: {
          value: result.organizationName,
          canRead: !!result.canReadOrganizationRead,
          canEdit: !!result.canReadOrganizationEdit,
        },
      },
    };
  }

  async update(input: UpdatePartnership, session: ISession) {
    const object = await this.readOne(input.id, session);

    await this.db.sgUpdateProperties({
      session,
      object,
      props: ['agreementStatus', 'mouStatus', 'mouStart', 'mouEnd', 'types'],
      changes: {
        ...input,
        types: input.types as any,
      },
      nodevar: 'partnership',
    });

    return this.readOne(input.id, session);
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find partnership');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete partnership', {
        exception: e,
      });

      throw new ServerException('Failed to delete partnership');
    }
  }

  async list(
    input: Partial<PartnershipListInput>,
    session: ISession
  ): Promise<PartnershipListOutput> {
    const { page, count, sort, order, filter } = {
      ...PartnershipListInput.defaultVal,
      ...input,
    };

    const { projectId } = filter;
    let result: {
      items: Partnership[];
      hasMore: boolean;
      total: number;
    } = { items: [], hasMore: false, total: 0 };

    if (projectId) {
      const query = `
      MATCH
        (token:Token {active: true, value: $token})
        <-[:token {active: true}]-
        (requestingUser:User {
          active: true,
          id: $requestingUserId
        }),
        (project:Project {id: $projectId, active: true, owningOrgId: $owningOrgId})
        -[:partnership]->(partnership:Partnership {active:true})
      WITH COUNT(partnership) as total, project, partnership
          MATCH (partnership {active: true})-[:agreementStatus {active:true }]->(agreementStatus:Property {active: true})
          RETURN total, partnership.id as id, agreementStatus.value as agreementStatus, partnership.createdAt as createdAt
          ORDER BY ${sort} ${order}
          SKIP $skip LIMIT $count
      `;
      const projBudgets = await this.db
        .query()
        .raw(query, {
          token: session.token,
          requestingUserId: session.userId,
          owningOrgId: session.owningOrgId,
          projectId,
          skip: (page - 1) * count,
          count,
        })
        .run();

      result.items = await Promise.all(
        projBudgets.map(async (partnership) =>
          this.readOne(partnership.id, session)
        )
      );
    } else {
      result = await this.db.list<Partnership>({
        session,
        nodevar: 'partnership',
        aclReadProp: 'canReadPartnerships',
        aclEditProp: 'canCreatePartnership',
        props: [
          { name: 'agreementStatus', secure: true },
          { name: 'mouStatus', secure: true },
          { name: 'mouStart', secure: true },
          { name: 'mouEnd', secure: true },
          { name: 'organization', secure: false },
          { name: 'types', secure: true, list: true },
        ],
        input: {
          page,
          count,
          sort,
          order,
          filter,
        },
      });
    }

    return {
      items: result.items,
      hasMore: result.hasMore,
      total: result.total,
    };
  }
  async checkPartnershipConsistency(session: ISession): Promise<boolean> {
    const partnerships = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('partnership', 'Partnership', {
            active: true,
          }),
        ],
      ])
      .return('partnership.id as id')
      .run();

    return (
      (
        await Promise.all(
          partnerships.map(async (partnership) => {
            return this.db.hasProperties({
              session,
              id: partnership.id,
              props: [
                'agreementStatus',
                'mouStatus',
                'mouStart',
                'mouEnd',
                'types',
              ],
              nodevar: 'partnership',
            });
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          partnerships.map(async (partnership) => {
            return this.db.isUniqueProperties({
              session,
              id: partnership.id,
              props: [
                'agreementStatus',
                'mouStatus',
                'mouStart',
                'mouEnd',
                'types',
              ],
              nodevar: 'partnership',
            });
          })
        )
      ).every((n) => n)
    );
  }
}
