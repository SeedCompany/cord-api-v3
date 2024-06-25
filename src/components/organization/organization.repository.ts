import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import {
  DuplicateException,
  ID,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DtoRepository, OnIndex } from '~/core/database';
import {
  ACTIVE,
  createNode,
  defineSorters,
  filter,
  FullTextIndex,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  merge,
  oncePerProject,
  paginate,
  rankSens,
  requestingUser,
  sortWith,
} from '~/core/database/query';
import {
  CreateOrganization,
  Organization,
  OrganizationFilters,
  OrganizationListInput,
  UpdateOrganization,
} from './dto';

@Injectable()
export class OrganizationRepository extends DtoRepository<
  typeof Organization,
  [session: Session]
>(Organization) {
  async create(input: CreateOrganization, session: Session) {
    if (!(await this.isUnique(input.name))) {
      throw new DuplicateException(
        'organization.name',
        'Organization with this name already exists',
      );
    }

    const initialProps = {
      name: input.name,
      acronym: input.acronym,
      address: input.address,
      types: input.types ?? [],
      reach: input.reach ?? [],
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(await createNode(Organization, { initialProps }))
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create organization');
    }

    return await this.readOne(result.id, session);
  }

  async update(changes: UpdateOrganization, session: Session) {
    const { id, ...simpleChanges } = changes;
    await this.updateProperties({ id }, simpleChanges);
    return await this.readOne(id, session);
  }

  protected hydrate(session: Session) {
    return (query: Query) =>
      query
        .optionalMatch([
          node('project', 'Project'),
          relation('out', '', 'partnership'),
          node('', 'Partnership'),
          relation('out', '', 'partner'),
          node('', 'Partner'),
          relation('out', 'organization'),
          node('node'),
        ])
        .apply(matchProjectScopedRoles({ session }))
        .with([
          'node',
          'collect(project) as projList',
          'keys(apoc.coll.frequenciesAsMap(apoc.coll.flatten(collect(scopedRoles)))) as scopedRoles',
        ])
        .subQuery((sub) =>
          sub
            .with('projList')
            .raw('UNWIND projList as project')
            .apply(matchProjectSens())
            .with('sensitivity')
            .orderBy(rankSens('sensitivity'), 'ASC')
            .raw('LIMIT 1')
            .return('sensitivity')
            .union()
            .with('projList')
            .with('projList')
            .raw('WHERE size(projList) = 0')
            .return(`'High' as sensitivity`),
        )
        .apply(matchProps())
        .return<{ dto: UnsecuredDto<Organization> }>(
          merge('props', {
            scope: 'scopedRoles',
            sensitivity: 'sensitivity',
          }).as('dto'),
        );
  }

  async list(input: OrganizationListInput, session: Session) {
    const query = this.db
      .query()
      .matchNode('node', 'Organization')
      .match(requestingUser(session))
      .apply(organizationFilters(input.filter))
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: (inner) => (query) =>
            query
              .optionalMatch([
                node('project', 'Project'),
                relation('out', '', 'partnership'),
                node('', 'Partnership'),
                relation('out', '', 'partner'),
                node('', 'Partner'),
                relation('out', 'organization'),
                node('node'),
              ])
              .apply(oncePerProject(inner)),
        }),
      )
      .apply(sortWith(organizationSorters, input))
      .apply(paginate(input, this.hydrate(session)));
    return (await query.first())!; // result from paginate() will always have 1 row.
  }

  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(OrgNameIndex.create()).run();
  }
}

export const organizationFilters = filter.define(() => OrganizationFilters, {
  userId: filter.pathExists((id) => [
    node('node'),
    relation('in', '', 'organization', ACTIVE),
    node('', 'User', { id }),
  ]),
  name: filter.fullText({
    index: () => OrgNameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Organization'),
        relation('out', '', 'name', ACTIVE),
        node('match'),
      ]),
    minScore: 0.8,
  }),
});

export const organizationSorters = defineSorters(Organization, {});

const OrgNameIndex = FullTextIndex({
  indexName: 'OrganizationName',
  labels: 'OrgName',
  properties: 'value',
  analyzer: 'standard-folding',
});
