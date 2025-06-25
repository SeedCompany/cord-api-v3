import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  InputException,
  NotFoundException,
  ReadAfterCreationFailed,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository, OnIndex } from '~/core/database';
import {
  ACTIVE,
  collect,
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
  sortWith,
} from '~/core/database/query';
import {
  type CreateOrganization,
  Organization,
  OrganizationFilters,
  type OrganizationListInput,
  type UpdateOrganization,
} from './dto';

@Injectable()
export class OrganizationRepository extends DtoRepository(Organization) {
  async create(input: CreateOrganization) {
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
      throw new CreationFailed(Organization);
    }

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(Organization)
        : e;
    });
  }

  async update(changes: UpdateOrganization) {
    const { id, joinedAlliances, allianceMembers, parentId, ...simpleChanges } =
      changes;
    await this.updateProperties({ id }, simpleChanges);

    if (joinedAlliances) {
      try {
        await this.updateRelationList({
          id: changes.id,
          relation: 'joinedAlliances',
          newList: joinedAlliances,
        });
      } catch (e) {
        throw e instanceof InputException
          ? e.withField('organization.joinedAlliances')
          : e;
      }
    }

    if (allianceMembers) {
      try {
        await this.updateRelationList({
          id: changes.id,
          relation: 'allianceMembers',
          newList: allianceMembers,
        });
      } catch (e) {
        throw e instanceof InputException
          ? e.withField('organization.allianceMembers')
          : e;
      }
    }

    if (parentId !== undefined) {
      await this.updateRelation('parent', 'Organization', changes.id, parentId);
    }

    return await this.readOne(id);
  }

  protected hydrate() {
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
        .apply(matchProjectScopedRoles())
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
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'alliance'),
              node('alliance', 'Organization'),
            ])
            .return(collect('alliance { .id }').as('alliance')),
        )
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'member'),
              node('member', 'Organization'),
            ])
            .return(collect('member { .id }').as('member')),
        )
        .optionalMatch([
          node('node'),
          relation('out', '', 'parent', ACTIVE),
          node('parent', 'Organization'),
        ])
        .apply(matchProps())
        .return<{ dto: UnsecuredDto<Organization> }>(
          merge('props', {
            scope: 'scopedRoles',
            sensitivity: 'sensitivity',
            parent: 'parent { .id }',
            joinedAlliances: 'alliance',
            allianceMembers: 'member',
          }).as('dto'),
        );
  }

  async list(input: OrganizationListInput) {
    const query = this.db
      .query()
      .matchNode('node', 'Organization')
      .apply(organizationFilters(input.filter))
      .apply(
        this.privileges.filterToReadable({
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
      .apply(paginate(input, this.hydrate()));
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
