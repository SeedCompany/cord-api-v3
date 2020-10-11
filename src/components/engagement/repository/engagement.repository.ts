import { node, Query, relation } from 'cypher-query-builder';
import { ISession, NotFoundException } from '../../../common';
import { DatabaseService, matchRequestingUser } from '../../../core';
import {
  calculateTotalAndPaginateListNoDBReturn,
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import { FileService } from '../../file';

export class Repository {
  constructor(
    protected readonly db: DatabaseService,
    protected readonly session: ISession,
    protected readonly files: FileService
  ) {}
  requestClass = RepositoryRequest;

  request() {
    return new this.requestClass(this.db, this.session, this.files);
  }
}

export class RepositoryRequest {
  query: Query;
  constructor(
    protected readonly db: DatabaseService,
    protected readonly session: ISession,
    protected readonly files: FileService
  ) {
    this.query = this.db.query();
    return this;
  }

  with(includes: any) {
    //this.query.raw('WITH *');
    for (const [key, value] of Object.entries(includes)) {
      this.query.raw('WITH $value AS ' + key, { value: value }); // TODO: this needs escaping to prevent injection attacks.
      //this.query.raw`WITH ${value} AS ` + key;
    }

    return this;
  }

  async runQuery() {
    this.query.raw('RETURN *');
    const result = await this.query.first();

    if (!result) {
      throw new NotFoundException('could not find Engagement', 'engagement.id');
    }

    return result;
  }
}

export class EngagementRepository extends Repository {
  requestClass = EngagementRepositoryRequest; // TODO: could perhaps infer this from class name

  request() {
    return new this.requestClass(this.db, this.session, this.files);
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

    this.query
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
      .call(
        calculateTotalAndPaginateListNoDBReturn,
        input,
        (q: any, sort: any, order: any) =>
          sort in this.securedProperties
            ? q
                .match([
                  node('node'),
                  relation('out', '', sort),
                  node('prop', 'Property'),
                ])
                .with('*')
                .orderBy('prop.value', order)
            : // eslint-disable-next-line @typescript-eslint/restrict-template-expressions
              q.with('*').orderBy(`node.${sort}`, order)
      );

    return this;
  }

  hydrateEngagements(session: ISession) {
    //if (engagementIds.length === 0) {
    //  throw new NotFoundException('no id given', 'engagement.id');
    //}

    //if (!session.userId) {
    //  //this.logger.debug('using anon user id');
    //  session.userId = this.config.anonUser.id;
    //}

    this.query
      .raw(
        `
            WITH engagementIds
            UNWIND engagementIds as nodeId
        `
      )
      .call(matchRequestingUser, session)
      // .match([node('node', 'Engagement', { id })])
      .raw('MATCH (node:Engagement { id: nodeId })')
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node('perms', 'Permission'),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property'),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with([
        'collect(prop) as propList',
        'permList',
        'node',
        `case
          when 'InternshipEngagement' IN labels(node)
          then 'InternshipEngagement'
          when 'LanguageEngagement' IN labels(node)
          then 'LanguageEngagement'
          end as __typename
          `,
      ])
      .optionalMatch([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('node'),
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
      .raw(
        `
            WITH {propList: propList, permList: permList, node: node, projectId: project.id, __typename: __typename, ceremonyId: ceremony.id, languageId: language.id, countryOfOriginId: countryOfOrigin.id, mentorId: mentor.id} as engagement
            WITH collect(engagement) as engagements
          `
      );
    return this;
  }
}
