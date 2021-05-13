import { Injectable } from '@nestjs/common';
import { inArray, node, Node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import { CalendarDate, ID, Session } from '../../common';
// import { DateTime } from '../../common/temporal';
import { DatabaseService, matchRequestingUser, matchSession } from '../../core';
import { DbChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Role, rolesForScope } from '../authorization';
import { ProjectType } from '../project';
import {
  EngagementListInput,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
  OngoingEngagementStatuses,
  PnpData,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';

@Injectable()
export class EngagementRepository {
  constructor(private readonly db: DatabaseService) {}

  // CREATE ///////////////////////////////////////////////////////////
  query(): Query {
    return this.db.query();
  }

  async findNode(type: string, id: ID): Promise<Dictionary<any> | undefined> {
    if (type === 'project') {
      return await this.db
        .query()
        .match([node('project', 'Project', { id })])
        .return('project.id')
        .first();
    } else if (type === 'language') {
      return await this.db
        .query()
        .match([node('language', 'Language', { id })])
        .return('language.id')
        .first();
    } else if (type === 'intern') {
      return await this.db
        .query()
        .match([node('intern', 'User', { id })])
        .return('intern.id')
        .first();
    } else if (type === 'mentor') {
      return await this.db
        .query()
        .match([node('mentor', 'User', { id })])
        .return('mentor.id')
        .first();
    }
    // else if (type === 'project') {
    //   return await this.db
    //     .query()
    //     .match([node('project', 'Project', { id })])
    //     .return('project.id')
    //     .first();
    // }
    else if (type === 'countryOfOrigin') {
      return await this.db
        .query()
        .match([
          node('country', 'Location', {
            id,
          }),
        ])
        .return('country.id')
        .first();
    } else {
      return undefined;
    }
  }

  readOne(id: ID, session: Session) {
    return this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Engagement', { id })])
      .apply(matchPropList)
      .optionalMatch([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('node'),
      ])
      .apply(matchMemberRoles(session.userId))
      .with([
        'propList',
        'node',
        'project',
        'memberRoles',
        `case
    when 'InternshipEngagement' IN labels(node)
    then 'InternshipEngagement'
    when 'LanguageEngagement' IN labels(node)
    then 'LanguageEngagement'
    end as __typename
    `,
      ])
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
        node('node'),
        relation('out', '', 'pnpData', { active: true }),
        node('pnpData'),
      ])
      .return([
        'propList, node, project.id as project',
        '__typename, ceremony.id as ceremony',
        'language.id as language',
        'intern.id as intern',
        'countryOfOrigin.id as countryOfOrigin',
        'mentor.id as mentor',
        'pnpData',
        'memberRoles',
      ])
      .asResult<
        StandardReadResult<
          Omit<
            DbPropsOfDto<LanguageEngagement & InternshipEngagement>,
            | '__typename'
            | 'ceremony'
            | 'language'
            | 'pnpData'
            | 'countryOfOrigin'
            | 'intern'
            | 'mentor'
          >
        > & {
          __typename: 'LanguageEngagement' | 'InternshipEngagement';
          language: ID;
          ceremony: ID;
          project: ID;
          intern: ID;
          countryOfOrigin: ID;
          mentor: ID;
          pnpData?: Node<PnpData>;
          memberRoles: Role[][];
        }
      >();
  }

  // getActualChanges(
  //   type: string,
  //   object: LanguageEngagement | InternshipEngagement,
  //   input: UpdateLanguageEngagement | UpdateInternshipEngagement
  // ): ChangesOf<LanguageEngagement> | ChangesOf<InternshipEngagement> {
  //   if (type === 'language') {
  //     return this.db.getActualChanges(LanguageEngagement, object, input);
  //   }
  //   // else if (type === 'internship')
  //   else {
  //     return this.db.getActualChanges(InternshipEngagement, object, input);
  //   }
  //   // return undefined;
  // }

  // UPDATE ///////////////////////////////////////////////////////////

  getActualLanguageChanges(
    object: LanguageEngagement,
    input: UpdateLanguageEngagement
  ) {
    return this.db.getActualChanges(LanguageEngagement, object, input);
  }

  async updateLanguageProperties(
    object: LanguageEngagement,
    changes: DbChanges<LanguageEngagement>
  ): Promise<void> {
    await this.db.updateProperties({
      type: LanguageEngagement,
      object,
      changes,
    });
  }

  getActualInternshipChanges(
    object: InternshipEngagement,
    input: UpdateInternshipEngagement
  ) {
    return this.db.getActualChanges(InternshipEngagement, object, input);
  }

  mentorQ(
    mentorId: ID,
    session: Session,
    input: UpdateInternshipEngagement,
    createdAt: DateTime
  ): Query {
    return this.db
      .query()
      .match(matchSession(session))
      .match([node('newMentorUser', 'User', { id: mentorId })])
      .match([
        node('internshipEngagement', 'InternshipEngagement', {
          id: input.id,
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
          createdAt,
        }),
        node('newMentorUser'),
      ])
      .return('internshipEngagement.id as id');
  }

  countryQ(
    countryOfOriginId: ID,
    // session: Session,
    input: UpdateInternshipEngagement,
    createdAt: DateTime
  ): Query {
    return this.db
      .query()
      .match([
        node('newCountry', 'Location', {
          id: countryOfOriginId,
        }),
      ])
      .match([
        node('internshipEngagement', 'InternshipEngagement', {
          id: input.id,
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
          createdAt,
        }),
        node('newCountry'),
      ])
      .return('internshipEngagement.id as id');
  }

  async updateInternshipProperties(
    object: InternshipEngagement,
    changes: DbChanges<InternshipEngagement>
  ): Promise<void> {
    await this.db.updateProperties({
      type: InternshipEngagement,
      object,
      changes,
    });
  }

  async addLabelsToNodes(
    type: string,
    input: UpdateInternshipEngagement
  ): Promise<void> {
    if (type === 'position') {
      await this.db.addLabelsToPropNodes(input.id, 'position', [
        'InternPosition',
      ]);
    } else if (type === 'methodologies') {
      await this.db.addLabelsToPropNodes(input.id, 'methodologies', [
        'ProductMethodology',
      ]);
    }
  }

  // DELETE /////////////////////////////////////////////////////////

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  async findNodeToDelete(id: ID) {
    return await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id }),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
      ])
      .return('project.id as projectId')
      .asResult<{ projectId: ID }>()
      .first();
    // return result;
  }

  async deleteNode(
    object: LanguageEngagement | InternshipEngagement
  ): Promise<void> {
    await this.db.deleteNode(object);
  }

  // LIST ///////////////////////////////////////////////////////////

  list(session: Session, { filter, ...input }: EngagementListInput) {
    let label = 'Engagement';
    if (filter.type === 'language') {
      label = 'LanguageEngagement';
    } else if (filter.type === 'internship') {
      label = 'InternshipEngagement';
    }
    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'engagement', { active: true }),
              node('project', 'Project', {
                id: filter.projectId,
              }),
            ]
          : []),
      ])
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

  // CONSISTENCY ////////////////////////////////////////////////////

  async checkEngagementConsistency(
    baseNode: string
  ): Promise<Array<Dictionary<any>>> {
    return await this.db
      .query()
      .match([node('eng', baseNode)])
      .return('eng.id as id')
      .run();
  }

  isRelationshipUnique(
    type: string,
    session: Session,
    ie: any,
    rel: string
  ): Promise<boolean> {
    return this.db.isRelationshipUnique({
      session,
      id: ie.id,
      relName: rel,
      srcNodeLabel:
        type === 'language' ? 'LanguageEngagement' : 'InternshipEngagement',
    });
  }

  async hasProperties(
    type: string,
    session: Session,
    ie: any,
    requiredProperties: string[]
  ): Promise<boolean> {
    return await this.db.hasProperties({
      session,
      id: ie.id,
      props: requiredProperties,
      nodevar:
        type === 'language' ? 'LanguageEngagement' : 'InternshipEngagement',
    });
  }

  async listEngagementsWithDateRange() {
    return await this.db
      .query()
      .match(node('engagement', 'Engagement'))
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('engagement'),
      ])
      .optionalMatch([
        node('project'),
        relation('out', '', 'mouStart', { active: true }),
        node('mouStart', 'Property'),
      ])
      .optionalMatch([
        node('project'),
        relation('out', '', 'mouEnd', { active: true }),
        node('mouEnd', 'Property'),
      ])
      .optionalMatch([
        node('engagement'),
        relation('out', '', 'startDateOverride', { active: true }),
        node('startDateOverride', 'Property'),
      ])
      .optionalMatch([
        node('engagement'),
        relation('out', '', 'endDateOverride', { active: true }),
        node('endDateOverride', 'Property'),
      ])
      .with([
        'engagement',
        'mouStart',
        'mouEnd',
        'startDateOverride',
        'endDateOverride',
      ])
      .raw(
        'WHERE (mouStart.value IS NOT NULL AND mouEnd.value IS NOT NULL) OR (startDateOverride.value IS NOT NULL AND endDateOverride.value IS NOT NULL)'
      )
      .return([
        'engagement.id as engagementId',
        'mouStart.value as startDate',
        'mouEnd.value as endDate',
        'startDateOverride.value as startDateOverride',
        'endDateOverride.value as endDateOverride',
      ])
      .asResult<{
        engagementId: ID;
        startDate: CalendarDate;
        endDate: CalendarDate;
        startDateOverride: CalendarDate;
        endDateOverride: CalendarDate;
      }>()
      .run();
  }

  async verifyRelationshipEligibility(
    projectId: ID,
    otherId: ID,
    isTranslation: boolean,
    property: 'language' | 'intern'
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
        relation('out', '', 'engagement', { active: true }),
        node('engagement'),
        relation('out', '', property, { active: true }),
        node('other'),
      ])
      .return(['project', 'other', 'engagement'])
      .asResult<{
        project?: Node<{ type: ProjectType }>;
        other?: Node;
        engagement?: Node;
      }>()
      .first();
  }

  startQuery(engagementId: ID | undefined, languageId: ID | undefined) {
    return () =>
      this.db.query().apply((query) =>
        engagementId
          ? query.match([
              node('languageEngagement', 'LanguageEngagement', {
                id: engagementId,
              }),
              relation('out', '', 'language', { active: true }),
              node('language', 'Language'),
            ])
          : query.match([node('language', 'Language', { id: languageId })])
      );
  }
}
