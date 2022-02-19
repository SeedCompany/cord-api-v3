import { Injectable } from '@nestjs/common';
import { inArray, node, Node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  generateId,
  ID,
  labelForView,
  mapFromList,
  NotFoundException,
  ObjectView,
  ResourceShape,
  ServerException,
  Session,
  simpleSwitch,
  typenameForView,
  UnsecuredDto,
  viewOfChangeset,
} from '../../common';
import { CommonRepository, OnIndex } from '../../core';
import { DbChanges, getChanges } from '../../core/database/changes';
import {
  ACTIVE,
  coalesce,
  createNode,
  createRelationships,
  INACTIVE,
  matchChangesetAndChangedProps,
  matchProjectSensToLimitedScopeMap,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  requestingUser,
  sorting,
  whereNotDeletedInChangeset,
} from '../../core/database/query';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { FileId } from '../file';
import { ProjectType } from '../project';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
  EngagementListInput,
  EngagementStatus,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
  OngoingEngagementStatuses,
} from './dto';

export type LanguageOrEngagementId = MergeExclusive<
  { engagementId: ID },
  { languageId: ID }
>;

@Injectable()
export class EngagementRepository extends CommonRepository {
  async doesNodeExist(resource: ResourceShape<any>, id: ID) {
    const result = await this.db
      .query()
      .match(node('node', resource.name, { id }))
      .return('node.id')
      .first();
    return !!result;
  }

  async readOne(id: ID, session: Session, view?: ObjectView) {
    const query = this.db
      .query()
      .matchNode('node', labelForView('Engagement', view), { id })
      .apply(this.hydrate(session, view));
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find Engagement');
    }

    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    return await this.db
      .query()
      .matchNode('node', labelForView('Engagement', view))
      .where({ 'node.id': inArray(ids) })
      .apply(this.hydrate(session, view))
      .map('dto')
      .run();
  }

  protected hydrate(session: Session, view?: ObjectView) {
    return (query: Query) =>
      query
        .match([
          node('project'),
          // active check not needed here as project will never change
          // the relationships could be inactive if made in a changeset, we don't care either way.
          relation('out', '', 'engagement'),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles(session, { view }))
        .apply(matchChangesetAndChangedProps(view?.changeset))
        .optionalMatch([
          node('node'),
          relation('out', '', 'ceremony', ACTIVE),
          node('ceremony'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'language', ACTIVE),
          node('language'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'intern', ACTIVE),
          node('intern'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'countryOfOrigin', ACTIVE),
          node('countryOfOrigin'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'mentor', ACTIVE),
          node('mentor'),
        ])
        .optionalMatch([
          node('project'),
          relation('out', '', 'mouStart', ACTIVE),
          node('mouStart'),
        ])
        .optionalMatch([
          node('project'),
          relation('out', '', 'mouEnd', ACTIVE),
          node('mouEnd'),
        ])
        .return<{ dto: UnsecuredDto<Engagement> }>(
          merge('props', 'changedProps', {
            __typename: typenameForView(
              ['LanguageEngagement', 'InternshipEngagement'],
              view
            ),
            project: 'project.id',
            language: 'language.id',
            ceremony: 'ceremony.id',
            intern: 'intern.id',
            countryOfOrigin: 'countryOfOrigin.id',
            mentor: 'mentor.id',
            startDate: coalesce(
              'changedProps.startDateOverride',
              'props.startDateOverride',
              'mouStart.value'
            ),
            endDate: coalesce(
              'changedProps.endDateOverride',
              'props.endDateOverride',
              'mouEnd.value'
            ),
            changeset: 'changeset.id',
          }).as('dto')
        );
  }

  // CREATE ///////////////////////////////////////////////////////////

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    changeset?: ID
  ) {
    const pnpId = (await generateId()) as FileId;

    const {
      projectId,
      languageId,
      methodology: _,
      ...initialProps
    } = {
      ...mapFromList(CreateLanguageEngagement.Props, (k) => [k, undefined]),
      ...input,
      status: input.status || EngagementStatus.InDevelopment,
      pnp: pnpId,
      initialEndDate: undefined,
      statusModifiedAt: undefined,
      lastSuspendedAt: undefined,
      lastReactivatedAt: undefined,
      modifiedAt: DateTime.local(),
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(await createNode(LanguageEngagement, { initialProps }))
      .apply(
        createRelationships(LanguageEngagement, {
          in: {
            engagement: ['Project', projectId],
            changeset: ['Changeset', changeset],
          },
          out: { language: ['Language', languageId] },
        })
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('Could not create Language Engagement');
    }

    return { id: result.id, pnpId };
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    changeset?: ID
  ) {
    const growthPlanId = (await generateId()) as FileId;

    const {
      projectId,
      internId,
      mentorId,
      countryOfOriginId,
      ...initialProps
    } = {
      ...mapFromList(CreateInternshipEngagement.Props, (k) => [k, undefined]),
      ...input,
      status: input.status || EngagementStatus.InDevelopment,
      growthPlan: growthPlanId,
      initialEndDate: undefined,
      statusModifiedAt: undefined,
      lastSuspendedAt: undefined,
      lastReactivatedAt: undefined,
      modifiedAt: DateTime.local(),
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(await createNode(InternshipEngagement, { initialProps }))
      .apply(
        createRelationships(InternshipEngagement, {
          in: {
            engagement: ['Project', projectId],
            changeset: ['Changeset', changeset],
          },
          out: {
            intern: ['User', internId],
            mentor: ['User', mentorId],
            countryOfOrigin: ['Location', countryOfOriginId],
          },
        })
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new NotFoundException();
    }

    return { id: result.id, growthPlanId };
  }

  // UPDATE ///////////////////////////////////////////////////////////

  getActualLanguageChanges = getChanges(LanguageEngagement);

  async updateLanguageProperties(
    object: LanguageEngagement | UnsecuredDto<LanguageEngagement>,
    changes: DbChanges<LanguageEngagement>,
    changeset?: ID
  ): Promise<void> {
    await this.db.updateProperties({
      type: LanguageEngagement,
      object,
      changes,
      changeset,
    });
  }

  getActualInternshipChanges = getChanges(InternshipEngagement);

  async updateMentor(id: ID, mentorId: ID) {
    await this.db
      .query()
      .match([node('newMentorUser', 'User', { id: mentorId })])
      .match([
        node('internshipEngagement', 'InternshipEngagement', {
          id,
        }),
      ])
      .optionalMatch([
        node('internshipEngagement'),
        relation('out', 'rel', 'mentor', ACTIVE),
        node('oldMentorUser', 'User'),
      ])
      .set({
        values: {
          rel: {
            active: false,
          },
        },
      })
      .create([
        node('internshipEngagement'),
        relation('out', '', 'mentor', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('newMentorUser'),
      ])
      .return('internshipEngagement.id as id')
      .run();
  }

  async updateCountryOfOrigin(id: ID, countryOfOriginId: ID) {
    await this.db
      .query()
      .match([
        node('newCountry', 'Location', {
          id: countryOfOriginId,
        }),
      ])
      .match([
        node('internshipEngagement', 'InternshipEngagement', {
          id,
        }),
      ])
      .optionalMatch([
        node('internshipEngagement'),
        relation('out', 'rel', 'countryOfOrigin', ACTIVE),
        node('oldCountry', 'Location'),
      ])
      .set({
        values: {
          rel: {
            active: false,
          },
        },
      })
      .create([
        node('internshipEngagement'),
        relation('out', '', 'countryOfOrigin', {
          active: true,
          createdAt: DateTime.local(),
        }),
        node('newCountry'),
      ])
      .return('internshipEngagement.id as id')
      .run();
  }

  async updateInternshipProperties(
    object: InternshipEngagement | UnsecuredDto<InternshipEngagement>,
    changes: DbChanges<InternshipEngagement>,
    changeset?: ID
  ): Promise<void> {
    await this.db.updateProperties({
      type: InternshipEngagement,
      object,
      changes,
      changeset,
    });
  }

  // LIST ///////////////////////////////////////////////////////////

  async list(
    input: EngagementListInput,
    session: Session,
    changeset?: ID,
    limitedScope?: AuthSensitivityMapping // setup limitedScope just in case we need it later on
  ) {
    const label =
      simpleSwitch(input.filter.type, {
        language: 'LanguageEngagement',
        internship: 'InternshipEngagement',
      }) ?? 'Engagement';

    const result = await this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            ...(limitedScope
              ? [
                  node('project', 'Project'),
                  relation('out', '', 'engagement', ACTIVE),
                ]
              : input.filter.projectId
              ? [
                  node('project', 'Project', { id: input.filter.projectId }),
                  relation('out', '', 'engagement', ACTIVE),
                ]
              : []),
            node('node', 'Engagement'),
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
                    relation('out', '', 'engagement', INACTIVE),
                    node('node', label),
                    relation('in', '', 'changeset', ACTIVE),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return(['node', 'project'])
              : q
          )
      )
      .match(requestingUser(session))
      .apply(matchProjectSensToLimitedScopeMap(limitedScope))
      .apply(sorting(IEngagement, input))
      .apply(paginate(input, this.hydrate(session, viewOfChangeset(changeset))))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listAllByProjectId(projectId: ID, session: Session) {
    return await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', ACTIVE),
        node('node', 'Engagement'),
      ])
      .apply(this.hydrate(session))
      .map('dto')
      .run();
  }

  async getOngoingEngagementIds(projectId: ID) {
    const rows = await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', ACTIVE),
        node('engagement'),
        relation('out', '', 'status', ACTIVE),
        node('sn', 'Property'),
      ])
      .where({
        sn: {
          value: inArray(OngoingEngagementStatuses),
        },
      })
      .return<{ id: ID }>('engagement.id as id')
      .run();
    return rows.map((r) => r.id);
  }

  async verifyRelationshipEligibility(
    projectId: ID,
    otherId: ID,
    isTranslation: boolean,
    property: 'language' | 'intern',
    changeset?: ID
  ) {
    return await this.db
      .query()
      .optionalMatch(node('project', 'Project', { id: projectId }))
      .optionalMatch(
        node('other', isTranslation ? 'Language' : 'User', {
          id: otherId,
        })
      )
      .optionalMatch([
        node('project'),
        relation('out', '', 'engagement', { active: !changeset }),
        node('engagement'),
        relation('out', '', property, ACTIVE),
        node('other'),
      ])
      .optionalMatch(
        changeset
          ? [
              node('engagement'),
              relation('in', '', 'changeset', ACTIVE),
              node('changesetNode', 'Changeset', { id: changeset }),
            ]
          : [node('engagement')]
      )
      .return(['project', 'other', 'engagement'])
      .asResult<{
        project?: Node<{ type: ProjectType }>;
        other?: Node;
        engagement?: Node;
      }>()
      .first();
  }

  async doesLanguageHaveExternalFirstScripture(id: LanguageOrEngagementId) {
    const result = await this.db
      .query()
      .apply(this.matchLanguageOrEngagement(id))
      .match([
        node('language'),
        relation('out', '', 'hasExternalFirstScripture', ACTIVE),
        node('', 'Property', { value: true }),
      ])
      .return('language')
      .first();
    return !!result;
  }

  async doOtherEngagementsHaveFirstScripture(id: LanguageOrEngagementId) {
    const result = await this.db
      .query()
      .apply(this.matchLanguageOrEngagement(id))
      .match([
        node('language'),
        relation('in', '', 'language', ACTIVE),
        node('otherLanguageEngagements', 'LanguageEngagement'),
        relation('out', '', 'firstScripture', ACTIVE),
        node('', 'Property', { value: true }),
      ])
      .return('otherLanguageEngagements')
      .first();
    return !!result;
  }

  private matchLanguageOrEngagement({
    engagementId,
    languageId,
  }: LanguageOrEngagementId) {
    return (query: Query) =>
      engagementId
        ? query.match([
            node('languageEngagement', 'LanguageEngagement', {
              id: engagementId,
            }),
            relation('out', '', 'language', ACTIVE),
            node('language', 'Language'),
          ])
        : query.match([node('language', 'Language', { id: languageId })]);
  }

  @OnIndex()
  private createIndexes() {
    return this.getConstraintsFor(IEngagement);
  }
}
