import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  generateId,
  ID,
  labelForView,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  ACTIVE,
  coalesce,
  createNode,
  createRelationships,
  INACTIVE,
  matchChangesetAndChangedProps,
  matchProjectSensToLimitedScopeMap,
  matchProps,
  matchPropsAndProjectSensAndScopedRoles,
  matchRequestingUser,
  merge,
  paginate,
  requestingUser,
  sorting,
  whereNotDeletedInChangeset,
} from '../../core/database/query';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import {
  CreatePartnership,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipListInput,
} from './dto';

@Injectable()
export class PartnershipRepository extends DtoRepository<
  typeof Partnership,
  [session: Session, view?: ObjectView]
>(Partnership) {
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

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const label = labelForView('Partnership', view);

    return await this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            node('project'),
            relation('out', '', 'partnership', ACTIVE),
            node('node', label),
          ])
          .raw('WHERE node.id in $ids', { ids })
          .return('project, node')
          .apply((q) =>
            view?.changeset
              ? q
                  .union()
                  .match([
                    node('project'),
                    relation('out', '', 'partnership', INACTIVE),
                    node('node', label),
                    relation('in', '', 'changeset', ACTIVE),
                    node('changeset', 'Changeset', { id: view.changeset }),
                  ])
                  .raw('WHERE node.id in $ids')
                  .return('project, node')
              : q
          )
      )
      .match([
        node('node'),
        relation('out', '', 'partner'),
        node('partner', 'Partner'),
        relation('out', '', 'organization', ACTIVE),
        node('org', 'Organization'),
      ])
      .apply(matchPropsAndProjectSensAndScopedRoles(session, { view }))
      .apply(matchChangesetAndChangedProps(view?.changeset))
      .apply(matchProps({ nodeName: 'project', outputVar: 'projectProps' }))
      .apply(
        matchProps({
          nodeName: 'project',
          view,
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
        }).as('dto')
      )
      .map('dto')
      .run();
  }

  async list(
    input: PartnershipListInput,
    session: Session,
    changeset?: ID,
    limitedScope?: AuthSensitivityMapping
  ) {
    const matchProjectId = input.filter.projectId
      ? { id: input.filter.projectId }
      : {};

    const result = await this.db
      .query()
      .subQuery((s) =>
        s
          .match([
            ...(limitedScope
              ? [
                  node('project', 'Project', matchProjectId),
                  relation('out', '', 'partnership'),
                ]
              : input.filter.projectId
              ? [
                  node('project', 'Project', { id: input.filter.projectId }),
                  relation('out', '', 'partnership', ACTIVE),
                ]
              : []),
            node('node', 'Partnership'),
          ])
          .apply(whereNotDeletedInChangeset(changeset))
          .return([
            'node',
            input.filter.projectId || limitedScope ? 'project' : '',
          ])
          .apply((q) =>
            changeset && input.filter.projectId
              ? q
                  .union()
                  .match([
                    node('project', 'Project', { id: input.filter.projectId }),
                    relation('out', '', 'partnership', INACTIVE),
                    node('node', 'Partnership'),
                    relation('in', '', 'changeset', ACTIVE),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return(['node', 'project'])
              : q
          )
      )

      .match(requestingUser(session))
      .apply(matchProjectSensToLimitedScopeMap(limitedScope))
      .apply(sorting(Partnership, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async verifyRelationshipEligibility(
    projectId: ID,
    partnerId: ID,
    changeset?: ID
  ) {
    return (
      (await this.db
        .query()
        .optionalMatch(node('partner', 'Partner', { id: partnerId }))
        .optionalMatch(node('project', 'Project', { id: projectId }))
        .subQuery((sub) =>
          sub
            .with('project, partner')
            .optionalMatch([
              node('project'),
              relation('out', '', 'partnership', ACTIVE),
              node('partnership'),
              relation('out', '', 'partner', ACTIVE),
              node('partner'),
            ])
            .return(['partnership'])
            .apply((q) =>
              changeset
                ? q
                    .union()
                    .with('project, partner')
                    .match([node('changeset', 'Changeset', { id: changeset })])
                    .optionalMatch([
                      node('project'),
                      relation('out', '', 'partnership', INACTIVE),
                      node('partnership'),
                      relation('in', '', 'changeset', ACTIVE),
                      node('changeset'),
                    ])
                    .optionalMatch([
                      node('partnership'),
                      relation('out', '', 'partner', ACTIVE),
                      node('partner'),
                    ])
                    .return(['partnership'])
                : q
            )
        )
        .return(['partner', 'project', 'partnership'])
        .asResult<{ partner?: Node; project?: Node; partnership?: Node }>()
        .first()) ?? {}
    );
  }

  async isFirstPartnership(projectId: ID, changeset?: ID) {
    const result = await this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            node('project', 'Project', { id: projectId }),
            relation('out', '', 'partnership', ACTIVE),
            node('partnership'),
          ])
          .return(['partnership'])
          .apply((q) =>
            changeset
              ? q
                  .union()
                  .match([node('changeset', 'Changeset', { id: changeset })])
                  .match([
                    node('project', 'Project', { id: projectId }),
                    relation('out', '', 'partnership', INACTIVE),
                    node('partnership'),
                    relation('in', '', 'changeset', ACTIVE),
                    node('changeset'),
                  ])
                  .return(['partnership'])
              : q
          )
      )
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
        relation('out', 'oldRel', 'primary', ACTIVE),
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
          relation('in', '', 'partnership', ACTIVE),
          node('project', 'Project'),
          relation('out', '', 'partnership', ACTIVE),
          node('otherPartnership'),
        ])
        .raw('WHERE partnership <> otherPartnership')
        .with('otherPartnership');
    };
  }
}
