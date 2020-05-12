import {
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
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
        node(),
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
  permission = (property: string, sg: string, read: boolean, edit: boolean) => {
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
        node(),
      ],
    ];
  };

  async readOne(id: string, session: ISession): Promise<Partnership> {
    // const acls = {
    //   canReadAgreementStatus: true,
    //   canEditAgreementStatus: true,
    //   canReadMouStatus: true,
    //   canEditMouStatus: true,
    //   canReadMouStart: true,
    //   canEditMouStart: true,
    //   canReadMouEnd: true,
    //   canEditMouEnd: true,
    //   canReadTypes: true,
    //   canEditTypes: true,
    //   canReadOrganization: true,
    //   canEditOrganization: true,
    // };
    const readPartnership = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadPartnerships' }))
      .match([node('partnership', 'Partnership', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadAgreementStatus', 'Permission', {
          property: 'agreementStatus',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),
        relation('out', '', 'agreementStatus', { active: true }),
        node('agreementStatus', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadMouStatus', 'Permission', {
          property: 'mouStatus',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),
        relation('out', '', 'mouStatus', { active: true }),
        node('mouStatus', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadMouStart', 'Permission', {
          property: 'mouStart',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),
        relation('out', '', 'mouStart', { active: true }),
        node('mouStart', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadMouEnd', 'Permission', {
          property: 'mouEnd',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),

        relation('out', '', 'mouEnd', { active: true }),
        node('mouEnd', 'Property', { active: true }),
      ])
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
        node('organization', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('canReadTypes', 'Permission', {
          property: 'types',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('partnership'),
        relation('out', '', 'types', { active: true }),
        node('types', 'Property', { active: true }),
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
        Organization: [{ value: 'Organization' }],
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

    const result = await readPartnership.first();

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
        id: result.organization.properties.id,
        createdAt: result.organization.properties.createdAt,
        name: {
          value: result.organization.properties.name,
          canRead: true,
          canEdit: true,
        },
      },
    };
  }

  async list(
    { page, count, sort, order, filter }: PartnershipListInput,
    session: ISession
  ): Promise<PartnershipListOutput> {
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
            node('partnership', 'Partnership', {
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
          //...this.property('organizationId', input.organizationId),
          //...this.property('projectId', input.projectId),
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
          ...this.permission('agreementStatus', 'adminSG', true, true),
          ...this.permission('agreementStatus', 'readerSG', true, false),
          ...this.permission('mouStatus', 'adminSG', true, true),
          ...this.permission('mouStatus', 'readerSG', true, false),
          ...this.permission('mouStart', 'adminSG', true, true),
          ...this.permission('mouStart', 'readerSG', true, false),
          ...this.permission('mouEnd', 'adminSG', true, true),
          ...this.permission('mouEnd', 'readerSG', true, false),
          ...this.permission('types', 'adminSG', true, true),
          ...this.permission('types', 'readerSG', true, false),
        ])
        .return('partnership.id as id');

      await createPartnership.first();

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
