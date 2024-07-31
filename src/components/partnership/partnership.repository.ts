import { Injectable } from '@nestjs/common';
import { Node, node, Query, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  generateId,
  ID,
  labelForView,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
  viewOfChangeset,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  coalesce,
  createNode,
  createRelationships,
  defineSorters,
  filter,
  INACTIVE,
  matchChangesetAndChangedProps,
  matchProps,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  requestingUser,
  sortWith,
  variable,
  whereNotDeletedInChangeset,
} from '~/core/database/query';
import { FileService } from '../file';
import { FileId } from '../file/dto';
import { partnerFilters, partnerSorters } from '../partner/partner.repository';
import {
  CreatePartnership,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipByProjectAndPartnerInput,
  PartnershipFilters,
  PartnershipListInput,
  UpdatePartnership,
} from './dto';

@Injectable()
export class PartnershipRepository extends DtoRepository<
  typeof Partnership,
  [session: Session, view?: ObjectView]
>(Partnership) {
  constructor(private readonly files: FileService) {
    super();
  }
  async create(input: CreatePartnership, session: Session, changeset?: ID) {
    const { projectId, partnerId } = input;
    await this.verifyRelationshipEligibility(projectId, partnerId, changeset);

    const mouId = await generateId<FileId>();
    const agreementId = await generateId<FileId>();

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
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create partnership');
    }

    await this.files.createDefinedFile(
      mouId,
      `MOU`,
      session,
      result.id,
      'mou',
      input.mou,
      'partnership.mou',
    );

    await this.files.createDefinedFile(
      agreementId,
      `Partner Agreement`,
      session,
      result.id,
      'agreement',
      input.agreement,
      'partnership.agreement',
    );

    return result;
  }

  async update(
    changes: Omit<UpdatePartnership, 'mou' | 'agreement'>,
    changeset?: ID,
  ) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges, changeset);

    return undefined as unknown;
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
              : q,
          ),
      )
      .apply(this.hydrate(session, view))
      .map('dto')
      .run();
  }

  protected override hydrate(session: Session, view?: ObjectView) {
    return (query: Query) =>
      query
        .match([
          node('project'),
          relation('out', '', 'partnership'),
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
          }),
        )
        .return<{ dto: UnsecuredDto<Partnership> }>(
          merge('props', 'changedProps', {
            mouStart: coalesce(
              'changedProps.mouStartOverride',
              'props.mouStartOverride',
              'projectChangedProps.mouStart',
              'projectProps.mouStart',
            ),
            mouEnd: coalesce(
              'changedProps.mouEndOverride',
              'props.mouEndOverride',
              'projectChangedProps.mouEnd',
              'projectProps.mouEnd',
            ),
            parent: 'project',
            project: 'project { .id }',
            partner: 'partner { .id }',
            organization: 'org { .id }',
            changeset: 'changeset.id',
            mou: { id: 'props.mou' },
          }).as('dto'),
        );
  }

  async list(input: PartnershipListInput, session: Session, changeset?: ID) {
    const result = await this.db
      .query()
      .subQuery((s) =>
        s
          .match([
            node('project', 'Project', pickBy({ id: input.filter?.projectId })),
            relation('out', '', 'partnership', ACTIVE),
            node('node', 'Partnership'),
          ])
          .apply(whereNotDeletedInChangeset(changeset))
          .return(['node', 'project'])
          .apply((q) =>
            changeset && input.filter?.projectId
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
              : q,
          ),
      )
      .match(requestingUser(session))
      .apply(partnershipFilters(input.filter))
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sortWith(partnershipSorters, input))
      .apply(paginate(input, this.hydrate(session, viewOfChangeset(changeset))))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  private async verifyRelationshipEligibility(
    projectId: ID,
    partnerId: ID,
    changeset?: ID,
  ) {
    const result =
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
                : q,
            ),
        )
        .return(['partner', 'project', 'partnership'])
        .asResult<{ partner?: Node; project?: Node; partnership?: Node }>()
        .first()) ?? {};

    if (!result.project) {
      throw new NotFoundException(
        'Could not find project',
        'partnership.projectId',
      );
    }

    if (!result.partner) {
      throw new NotFoundException(
        'Could not find partner',
        'partnership.partnerId',
      );
    }

    if (result.partnership) {
      throw new DuplicateException(
        'partnership.projectId',
        'Partnership for this project and partner already exists',
      );
    }
    return result;
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
              : q,
          ),
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

  async loadPartnershipByProjectAndPartner(
    input: readonly PartnershipByProjectAndPartnerInput[],
    session: Session,
  ) {
    const results = await this.db
      .query()
      .unwind([...input], 'input')
      .match([
        node('project', 'Project', { id: variable('input.project.id') }),
        relation('out', '', 'partnership', ACTIVE),
        node('node'),
        relation('out', '', 'partner', ACTIVE),
        node('partner', 'Partner', { id: variable('input.partner.id') }),
      ])
      .apply(this.hydrate(session))
      .map('dto')
      .run();

    return results;
  }
}

export const partnershipFilters = filter.define(() => PartnershipFilters, {
  projectId: filter.skip,
  types: filter.intersectsProp(),
  partner: filter.sub(() => partnerFilters)((sub) =>
    sub
      .with('node as partnership')
      .match([
        node('partnership'),
        relation('out', '', 'partner'),
        node('node', 'Partner'),
      ]),
  ),
  types: filter.skip,
});

export const partnershipSorters = defineSorters(Partnership, {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'partner.*': (query, input) =>
    query
      .with('node as partnership')
      .match([
        node('partnership'),
        relation('out', '', 'partner'),
        node('node', 'Partner'),
      ])
      .apply(sortWith(partnerSorters, input)),
});
