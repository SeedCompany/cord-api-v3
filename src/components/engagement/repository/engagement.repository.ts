import { node, relation } from 'cypher-query-builder';
import { ISession } from '../../../common';
import {
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import {
  Repository,
  RepositoryRequest,
} from '../../../core/database/repository';

export class EngagementRepository extends Repository {
  requestClass = EngagementRepositoryRequest; // TODO: could perhaps infer this from class name

  request() {
    return new this.requestClass(this.db);
  }
}

export class EngagementRepositoryRequest extends RepositoryRequest {
  private readonly securedProperties = {
    status: true,
    statusModifiedAt: true,
    completeDate: true,
    disbursementCompleteDate: true,
    communicationsCompleteDate: true,
    initialEndDate: true,
    startDate: true,
    endDate: true,
    startDateOverride: true,
    endDateOverride: true,
    modifiedAt: true,
    lastSuspendedAt: true,
    lastReactivatedAt: true,
    ceremony: true,

    //Language Specific
    firstScripture: true,
    lukePartnership: true,
    sentPrintingDate: true,
    paraTextRegistryId: true,
    pnp: true,
    language: true,

    //Internship Specific
    position: true,
    growthPlan: true,
    methodologies: true,
    intern: true,
    mentor: true,
    countryOfOrigin: true,
  };

  findEngagementIdsByProjectId(session: ISession, filter: any, input: any) {
    let label = 'Engagement';
    if (filter.type === 'language') {
      label = 'LanguageEngagement';
    } else if (filter.type === 'internship') {
      label = 'InternshipEngagement';
    }

    this.query.match([
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
    ]);

    const isSortOnNode = !(input.sort in this.securedProperties); // if sort is not in secured properties; it is on the node itself.
    this.calculateTotalAndPaginateList(
      input.sort,
      input.order,
      input.page,
      input.count,
      isSortOnNode
    );

    this.query.raw('WITH {engagementIds: items, total: total} AS stash');
    return this;
  }

  hydrateEngagements(requestingUserId: string) {
    //if (engagementIds.length === 0) {
    //  throw new NotFoundException('no id given', 'engagement.id');
    //}

    this.query.raw(
      `
      WITH stash.engagementIds as engagementIds, $requestingUserId AS requestingUserId, stash
      UNWIND engagementIds as nodeId

      MATCH (requestingUser:User { id: requestingUserId })

      MATCH (node:Engagement { id: nodeId })
      OPTIONAL MATCH (requestingUser)<-[:member]-(:SecurityGroup)-[:permission]->(perms:Permission)-[:baseNode]->(node)

      WITH collect(distinct perms) as permList, node, stash
      MATCH (node)-[r { active: true }]->(props:Property)
      WITH {value: props.value, property: type(r)} as prop, permList, node, stash
      WITH collect(prop) as propList, permList, node, stash, case
          when 'InternshipEngagement' IN labels(node)
          then 'InternshipEngagement'
          when 'LanguageEngagement' IN labels(node)
          then 'LanguageEngagement'
          end as __typename
          
      OPTIONAL MATCH (project)-[:engagement { active: true }]->(node)

      OPTIONAL MATCH (node)-[:ceremony { active: true }]->(ceremony)
      OPTIONAL MATCH (node)-[:language { active: true }]->(language)
      OPTIONAL MATCH (node)-[:intern { active: true }]->(intern)
      OPTIONAL MATCH (node)-[:countryOfOrigin { active: true }]->(countryOfOrigin)
      OPTIONAL MATCH (node)-[:mentor { active: true }]->(mentor)

      WITH {propList: propList, permList: permList, node: node, projectId: project.id, __typename: __typename, ceremonyId: ceremony.id, languageId: language.id, countryOfOriginId: countryOfOrigin.id, mentorId: mentor.id} as engagement, stash
      WITH apoc.map.setKey(stash, 'engagements', collect(engagement)) AS stash
      `,
      { requestingUserId: requestingUserId }
    );

    return this;
  }
}
