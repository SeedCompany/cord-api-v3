import { Injectable } from '@nestjs/common';
import { inArray, node, Node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { ID, Resource, Session } from '../../common';
import { DatabaseService, matchRequestingUser } from '../../core';
import { DbChanges } from '../../core/database/changes';
import { matchMemberRoles, matchPropList } from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { Role, rolesForScope } from '../authorization';
import {
  InternshipEngagement,
  LanguageEngagement,
  OngoingEngagementStatuses,
  PnpData,
  UpdateLanguageEngagement,
} from './dto';

@Injectable()
export class EngagementRepository {
  constructor(private readonly db: DatabaseService) {}

  create(): Query {
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
    } else if (type === 'project') {
      return await this.db
        .query()
        .match([node('project', 'Project', { id })])
        .return('project.id')
        .first();
    } else if ((type = 'countryOfOrigin')) {
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

  getActualChanges(
    object: LanguageEngagement,
    input: UpdateLanguageEngagement
  ): Partial<
    Omit<UpdateLanguageEngagement, keyof Resource> &
      Pick<LanguageEngagement, 'modifiedAt'>
  > {
    return this.db.getActualChanges(LanguageEngagement, object, input);
  }

  async updateProperties(
    object: LanguageEngagement,
    changes: DbChanges<LanguageEngagement>
  ): Promise<void> {
    await this.db.updateProperties({
      type: LanguageEngagement,
      object,
      changes,
    });
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
}
