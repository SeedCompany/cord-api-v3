import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  coalesce,
  createNode,
  createRelationships,
  matchChangesetAndChangedProps,
  matchProps,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
  whereNotDeletedInChangeset,
} from '../../core/database/query';
import {
  CreatePartnership,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipListInput,
} from './dto';

@Injectable()
export class PartnershipRepository extends DtoRepository(Partnership) {
  async create(input: CreatePartnership, session: Session, changeset?: ID) {
    const mouId = await generateId();
    const agreementId = await generateId();

    const initialProps = {
      agreementStatus:
        input.agreementStatus || PartnershipAgreementStatus.NotAttached,
      agreement: agreementId,
      mou: mouId,
      mouStatus: input.mouStatus || PartnershipAgreementStatus.NotAttached,
      mouStartOverride: input.mouStartOverride,
      mouEndOverride: input.mouEndOverride,
      types: input.types,
      financialReportingType: input.financialReportingType,
      primary: input.primary,
      canDelete: true,
    };

    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Partnership, { initialProps }))
      .apply(
        createRelationships(Partnership, {
          in: {
            partnership: ['Project', input.projectId],
            changeset: ['Changeset', changeset],
          },
          out: {
            partner: ['Partner', input.partnerId],
          },
        })
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create partnership');
    }
    return { id: result.id, mouId, agreementId };
  }

  async readOne(id: ID, session: Session, changeset?: ID) {
    const query = this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            node('project'),
            relation('out', '', 'partnership', { active: true }),
            node('node', 'Partnership', { id }),
          ])
          .return('project, node')
          .apply((q) =>
            changeset
              ? q
                  .union()
                  .match([
                    node('project'),
                    relation('out', '', 'partnership', { active: false }),
                    node('node', 'Partnership', { id }),
                    relation('in', '', 'changeset', { active: true }),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return('project, node')
              : q
          )
      )
      .match([
        node('node'),
        relation('out', '', 'partner'),
        node('partner', 'Partner'),
        relation('out', '', 'organization', { active: true }),
        node('org', 'Organization'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .apply(matchChangesetAndChangedProps(changeset))
      .apply(matchProps({ nodeName: 'project', outputVar: 'projectProps' }))
      .apply(
        matchProps({
          nodeName: 'project',
          changeset,
          optional: true,
          outputVar: 'projectChangedProps',
        })
      )
      .return<{ dto: UnsecuredDto<Partnership> }>(
        merge('props', 'changedProps', {
          mouStart: coalesce(
            'changedProps.mouStartOverride',
            'props.mouStartOverride',
            'projectChangedProps.mouStart',
            'projectProps.mouStart'
          ),
          mouEnd: coalesce(
            'changedProps.mouEndOverride',
            'props.mouEndOverride',
            'projectChangedProps.mouEnd',
            'projectProps.mouEnd'
          ),
          project: 'project.id',
          partner: 'partner.id',
          organization: 'org.id',
          changeset: 'changeset.id',
          scope: 'scopedRoles',
        }).as('dto')
      );

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find partnership');
    }

    return result.dto;
  }

  async list(input: PartnershipListInput, session: Session, changeset?: ID) {
    const result = await this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            requestingUser(session),
            ...permissionsOfNode('Partnership'),
            ...(input.filter.projectId
              ? [
                  relation('in', '', 'partnership', { active: true }),
                  node('project', 'Project', { id: input.filter.projectId }),
                ]
              : []),
          ])
          .apply(whereNotDeletedInChangeset(changeset))
          .return('node')
          .apply((q) =>
            changeset && input.filter.projectId
              ? q
                  .union()
                  .match([
                    node('', 'Project', { id: input.filter.projectId }),
                    relation('out', '', 'partnership', { active: false }),
                    node('node', 'Partnership'),
                    relation('in', '', 'changeset', { active: true }),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return('node')
              : q
          )
      )
      .apply(sorting(Partnership, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
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
