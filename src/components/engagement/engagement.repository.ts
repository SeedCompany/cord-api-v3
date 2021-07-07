import { Injectable } from '@nestjs/common';
import { inArray, node, Node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  generateId,
  ID,
  mapFromList,
  NotFoundException,
  ResourceShape,
  ServerException,
  Session,
  simpleSwitch,
  UnsecuredDto,
} from '../../common';
import { CommonRepository } from '../../core';
import { DbChanges, getChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  createNode,
  createRelationships,
  matchChangesetAndChangedProps,
  matchPropsAndProjectSensAndScopedRoles,
  permissionsOfNode,
  requestingUser,
  whereNotDeletedInChangeset,
} from '../../core/database/query';
import { Role, rolesForScope } from '../authorization';
import { FileId } from '../file';
import { ProjectType } from '../project';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
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

  async readOne(id: ID, session: Session, changeset?: ID) {
    const query = this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            node('project'),
            relation('out', '', 'engagement', { active: true }),
            node('node', 'Engagement', { id }),
          ])
          .return('project, node')
          .apply((q) =>
            changeset
              ? q
                  .union()
                  .match([
                    node('project'),
                    relation('out', '', 'engagement', { active: false }),
                    node('node', 'Engagement', { id }),
                    relation('in', '', 'changeset', { active: true }),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return('project, node')
              : q
          )
      )
      .apply(matchPropsAndProjectSensAndScopedRoles(session))
      .apply(matchChangesetAndChangedProps(changeset))
      .optionalMatch([
        node('node'),
        relation('out', '', 'ceremony', { active: true }),
        node('ceremony'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'language', { active: true }),
        node('language'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'intern', { active: true }),
        node('intern'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'countryOfOrigin', { active: true }),
        node('countryOfOrigin'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'mentor', { active: true }),
        node('mentor'),
      ])
      .optionalMatch([
        node('project'),
        relation('out', '', 'mouStart', { active: true }),
        node('mouStart'),
      ])
      .optionalMatch([
        node('project'),
        relation('out', '', 'mouEnd', { active: true }),
        node('mouEnd'),
      ])
      .return<{ dto: UnsecuredDto<LanguageEngagement & InternshipEngagement> }>(
        `
          apoc.map.mergeList([
            props,
            changedProps,
            {
              __typename: [l in labels(node) where l in ['LanguageEngagement', 'InternshipEngagement']][0],
              language: language.id,
              ceremony: ceremony.id,
              intern: intern.id,
              countryOfOrigin: countryOfOrigin.id,
              mentor: mentor.id,
              startDate: coalesce(changedProps.startDateOverride, props.startDateOverride, mouStart.value),
              endDate: coalesce(changedProps.endDateOverride, props.endDateOverride, mouEnd.value),
              scope: scopedRoles,
              changeset: coalesce(changeset.id)
            }
          ]) as dto
        `
      );
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find Engagement');
    }

    return result.dto;
  }

  async getProjectIdByEngagement(id: ID) {
    const result = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id }),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
      ])
      .return('project.id as projectId')
      .asResult<{ projectId: ID }>()
      .first();
    if (!result) {
      throw new NotFoundException('Could not find project');
    }
    return result.projectId;
  }

  // CREATE ///////////////////////////////////////////////////////////

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    changeset?: ID
  ) {
    const pnpId = (await generateId()) as FileId;

    const { projectId, languageId, ...initialProps } = {
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
    object: LanguageEngagement,
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
        relation('out', 'rel', 'mentor', { active: true }),
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
        relation('out', 'rel', 'countryOfOrigin', { active: true }),
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
    object: InternshipEngagement,
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

  list(
    { filter, ...input }: EngagementListInput,
    session: Session,
    changeset?: ID
  ) {
    const label =
      simpleSwitch(filter.type, {
        language: 'LanguageEngagement',
        internship: 'InternshipEngagement',
      }) ?? 'Engagement';

    return this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            requestingUser(session),
            ...permissionsOfNode(label),
            ...(filter.projectId
              ? [
                  relation('in', '', 'engagement', { active: true }),
                  node('project', 'Project', { id: filter.projectId }),
                ]
              : []),
          ])
          .apply(whereNotDeletedInChangeset(changeset))
          .return('node')
          .apply((q) =>
            changeset && filter.projectId
              ? q
                  .union()
                  .match([
                    node('', 'Project', { id: filter.projectId }),
                    relation('out', '', 'engagement', { active: false }),
                    node('node', label),
                    relation('in', '', 'changeset', { active: true }),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return('node')
              : q
          )
      )
      .apply(calculateTotalAndPaginateList(IEngagement, input));
  }

  async listAllByProjectId(projectId: ID) {
    return await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', { active: true }),
        node('engagement', 'Engagement'),
      ])
      .return('engagement.id as id')
      .asResult<{ id: ID }>()
      .run();
  }

  async getOngoingEngagementIds(projectId: ID) {
    const rows = await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', { active: true }),
        node('engagement'),
        relation('out', '', 'status', { active: true }),
        node('sn', 'Property'),
      ])
      .where({
        sn: {
          value: inArray(OngoingEngagementStatuses),
        },
      })
      .return('engagement.id as id')
      .asResult<{ id: ID }>()
      .run();
    return rows.map((r) => r.id);
  }

  async rolesInScope(engagementId: string, session: Session) {
    const query = this.db
      .query()
      .match([
        node('eng', 'Engagement', { id: engagementId }),
        relation('in', 'engagement', { active: true }),
        node('node', 'Project'),
        relation('out', '', 'member', { active: true }),
        node('projectMember', 'ProjectMember'),
        relation('out', '', 'user', { active: true }),
        node('user', 'User', { id: session.userId }),
      ])
      .match([
        node('projectMember'),
        relation('out', 'r', 'roles', { active: true }),
        node('roles', 'Property'),
      ])
      .return('apoc.coll.flatten(collect(roles.value)) as memberRoles')
      .asResult<{
        memberRoles: Role[];
      }>();
    const roles = await query.first();

    return roles?.memberRoles.map(rolesForScope('project')) ?? [];
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
        relation('out', '', property, { active: true }),
        node('other'),
      ])
      .optionalMatch(
        changeset
          ? [
              node('engagement'),
              relation('in', '', 'changeset', { active: true }),
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
        relation('out', '', 'hasExternalFirstScripture', { active: true }),
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
        relation('in', '', 'language', { active: true }),
        node('otherLanguageEngagements', 'LanguageEngagement'),
        relation('out', '', 'firstScripture', { active: true }),
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
            relation('out', '', 'language', { active: true }),
            node('language', 'Language'),
          ])
        : query.match([node('language', 'Language', { id: languageId })]);
  }
}
