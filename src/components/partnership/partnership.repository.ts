import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropsAndProjectSensAndScopedRoles,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { ScopedRole } from '../authorization';
import {
  CreatePartnership,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipListInput,
} from './dto';

@Injectable()
export class PartnershipRepository extends DtoRepository(Partnership) {
  async create(input: CreatePartnership, session: Session) {
    const partnershipId = await generateId();
    const mouId = await generateId();
    const agreementId = await generateId();

    const props: Property[] = [
      {
        key: 'agreementStatus',
        value: input.agreementStatus || PartnershipAgreementStatus.NotAttached,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'agreement',
        value: agreementId,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mou',
        value: mouId,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouStatus',
        value: input.mouStatus || PartnershipAgreementStatus.NotAttached,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouStartOverride',
        value: input.mouStartOverride,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'mouEndOverride',
        value: input.mouEndOverride,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'types',
        value: input.types,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'financialReportingType',
        value: input.financialReportingType,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'primary',
        value: input.primary,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(partnershipId, 'Partnership', props))
      .with('node')
      .match([
        [
          node('partner', 'Partner', {
            id: input.partnerId,
          }),
        ],
        [node('project', 'Project', { id: input.projectId })],
      ])
      .create([
        node('project'),
        relation('out', '', 'partnership', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('node'),
        relation('out', '', 'partner', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('partner'),
      ])
      .return('node.id as id')
      .asResult<{ id: ID }>()
      .first();
    if (!result) {
      throw new ServerException('Failed to create partnership');
    }
    return { id: partnershipId, mouId, agreementId };
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'partnership', { active: true }),
        node('node', 'Partnership', { id }),
        relation('out', '', 'partner'),
        node('partner', 'Partner'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .return([
        'props',
        'scopedRoles',
        'project.id as projectId',
        'partner.id as partnerId',
      ])
      .asResult<{
        props: DbPropsOfDto<Partnership, true>;
        projectId: ID;
        partnerId: ID;
        scopedRoles: ScopedRole[];
      }>();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find partnership');
    }

    return result;
  }

  list({ filter, ...input }: PartnershipListInput, session: Session) {
    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('Partnership'),
        ...(filter.projectId
          ? [
              relation('in', '', 'partnership', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .apply(calculateTotalAndPaginateList(Partnership, input));
  }

  async verifyRelationshipEligibility(projectId: ID, partnerId: ID) {
    return (
      (await this.db
        .query()
        .optionalMatch(node('partner', 'Partner', { id: partnerId }))
        .optionalMatch(node('project', 'Project', { id: projectId }))
        .optionalMatch([
          node('project'),
          relation('out', '', 'partnership', { active: true }),
          node('partnership'),
          relation('out', '', 'partner', { active: true }),
          node('partner'),
        ])
        .return(['partner', 'project', 'partnership'])
        .asResult<{ partner?: Node; project?: Node; partnership?: Node }>()
        .first()) ?? {}
    );
  }

  async isFirstPartnership(projectId: ID) {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'partnership', { active: true }),
        node('partnership'),
      ])
      .return(['partnership'])
      .asResult<{ partnership?: Node }>()
      .first();
    return !result?.partnership;
  }

  async isAnyOtherPartnerships(id: ID) {
    const result = await this.db
      .query()
      .apply(this.matchOtherPartnerships(id))
      .return('otherPartnership.id')
      .first();
    return !!result;
  }

  async removePrimaryFromOtherPartnerships(id: ID) {
    await this.db
      .query()
      .apply(this.matchOtherPartnerships(id))
      .match([
        node('otherPartnership'),
        relation('out', 'oldRel', 'primary', { active: true }),
        node('', 'Property'),
      ])
      .setValues({
        'oldRel.active': false,
      })
      .with('otherPartnership')
      .create([
        node('otherPartnership'),
        relation('out', '', 'primary', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('newProperty', 'Property', {
          createdAt: DateTime.local(),
          value: false,
          sortValue: false,
        }),
      ])
      .run();
  }

  private matchOtherPartnerships(id: ID) {
    return (query: Query) => {
      query
        .match([
          node('partnership', 'Partnership', { id }),
          relation('in', '', 'partnership', { active: true }),
          node('project', 'Project'),
          relation('out', '', 'partnership', { active: true }),
          node('otherPartnership'),
        ])
        .raw('WHERE partnership <> otherPartnership')
        .with('otherPartnership');
    };
  }
}
