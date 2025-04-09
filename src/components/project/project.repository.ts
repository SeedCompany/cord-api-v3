import { Injectable } from '@nestjs/common';
import { inArray, node, not, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  NotFoundException,
  Sensitivity,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { ConfigService } from '~/core';
import { CommonRepository, OnIndex, UniquenessError } from '~/core/database';
import { ChangesOf, getChanges } from '~/core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  defineSorters,
  FullTextIndex,
  matchChangesetAndChangedProps,
  matchProjectSens,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  path,
  requestingUser,
  SortCol,
  sortWith,
  variable,
} from '~/core/database/query';
import { Privileges } from '../authorization';
import { locationSorters } from '../location/location.repository';
import { partnershipSorters } from '../partnership/partnership.repository';
import {
  CreateProject,
  IProject,
  Project,
  ProjectListInput,
  ProjectStep,
  resolveProjectType,
  stepToStatus,
  UpdateProject,
} from './dto';
import { projectFilters } from './project-filters.query';

@Injectable()
export class ProjectRepository extends CommonRepository {
  constructor(
    private readonly config: ConfigService,
    private readonly privileges: Privileges,
  ) {
    super();
  }

  async readOne(id: ID, userId: ID, changeset?: ID) {
    const query = this.db
      .query()
      .match([node('node', 'Project', { id })])
      .apply(this.hydrate(userId, changeset));
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find project');
    }

    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session, changeset?: ID) {
    return await this.db
      .query()
      .matchNode('node', 'Project')
      .where({ 'node.id': inArray(ids) })
      .apply(this.hydrate(session.userId, changeset))
      .map('dto')
      .run();
  }

  private hydrate(userId: ID, changeset?: ID) {
    return (query: Query) =>
      query
        .with(['node', 'node as project'])
        .apply(matchPropsAndProjectSensAndScopedRoles(userId))
        .apply(matchChangesetAndChangedProps(changeset))
        // optional because not defined until right after creation
        .optionalMatch([
          node('node'),
          relation('out', '', 'rootDirectory', ACTIVE),
          node('rootDirectory', 'Directory'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'partnership', ACTIVE),
          node('primaryPartnership', 'Partnership'),
          relation('out', '', 'primary', ACTIVE),
          node('', 'Property', { value: variable('true') }),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'primaryLocation', ACTIVE),
          node('primaryLocation', 'Location'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'marketingLocation', ACTIVE),
          node('marketingLocation', 'Location'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'fieldRegion', ACTIVE),
          node('fieldRegion', 'FieldRegion'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'owningOrganization', ACTIVE),
          node('organization', 'Organization'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'marketingRegionOverride', ACTIVE),
          node('marketingRegionOverride', 'Location'),
        ])
        .subQuery('node', (sub) =>
          sub
            .match([
              node('node'),
              relation('out', '', 'engagement', ACTIVE),
              node('engagement', 'Engagement'),
            ])
            .return('count(engagement) as engagementTotal'),
        )
        .return<{ dto: UnsecuredDto<Project> }>(
          merge('props', 'changedProps', {
            type: 'node.type',
            pinned: 'exists((:User { id: $requestingUser })-[:pinned]->(node))',
            isMember: '"member:true" in props.scope',
            rootDirectory: 'rootDirectory { .id }',
            primaryPartnership: 'primaryPartnership { .id }',
            primaryLocation: 'primaryLocation { .id }',
            marketingLocation: 'marketingLocation { .id }',
            fieldRegion: 'fieldRegion { .id }',
            owningOrganization: 'organization { .id }',
            engagementTotal: 'engagementTotal',
            changeset: 'changeset.id',
            marketingRegionOverride: 'marketingRegionOverride { .id }',
          }).as('dto'),
        );
  }

  getActualChanges(
    currentProject: UnsecuredDto<Project>,
    input: UpdateProject,
  ) {
    return getChanges(IProject)(currentProject, input);
  }

  async create(input: CreateProject) {
    const step = input.step ?? ProjectStep.EarlyConversations;
    const now = DateTime.local();
    const {
      primaryLocationId,
      fieldRegionId,
      marketingLocationId,
      marketingRegionOverrideId,
      otherLocationIds,
      type,
      ...initialProps
    } = {
      ...input,
      sensitivity: input.sensitivity ?? Sensitivity.High,
      mouStart: input.mouStart,
      mouEnd: input.mouEnd,
      initialMouEnd: undefined,
      stepChangedAt: now,
      estimatedSubmission: input.estimatedSubmission,
      tags: input.tags,
      financialReportReceivedAt: input.financialReportReceivedAt,
      financialReportPeriod: input.financialReportPeriod,
      step,
      status: stepToStatus(step),
      modifiedAt: now,
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(
        await createNode(resolveProjectType({ type }), {
          initialProps,
          baseNodeProps: { type },
        }),
      )
      .apply(
        createRelationships(IProject, 'out', {
          fieldRegion: ['FieldRegion', fieldRegionId],
          primaryLocation: ['Location', primaryLocationId],
          otherLocations: ['Location', otherLocationIds],
          marketingLocation: ['Location', marketingLocationId],
          marketingRegionOverride: ['Location', marketingRegionOverrideId],
          owningOrganization: ['Organization', this.config.defaultOrg.id],
        }),
      )
      .return<{ id: ID }>('node.id as id');
    let result;
    try {
      result = await query.first();
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'ProjectName') {
        throw Object.assign(
          new DuplicateException(
            'project.name',
            'Project with this name already exists',
          ),
          { value: e.value },
        );
      }
      if (e instanceof UniquenessError && e.label === 'DepartmentId') {
        throw Object.assign(
          new DuplicateException(
            'project.departmentId',
            'Another Project with this Department ID already exists',
          ),
          { value: e.value },
        );
      }
    }
    if (!result) {
      throw new ServerException('Failed to create project');
    }
    return result;
  }

  async update(
    existing: UnsecuredDto<Project>,
    changes: ChangesOf<Project, UpdateProject>,
    changeset?: ID,
  ) {
    const {
      primaryLocationId,
      marketingLocationId,
      marketingRegionOverrideId,
      fieldRegionId,
      ...simpleChanges
    } = changes;

    let result;
    try {
      result = await this.db.updateProperties({
        type: resolveProjectType({ type: existing.type }),
        object: existing,
        changes: simpleChanges,
        changeset,
      });
    } catch (e) {
      if (e instanceof UniquenessError && e.label === 'DepartmentId') {
        throw Object.assign(
          new DuplicateException(
            'project.departmentId',
            'Another Project with this Department ID already exists',
          ),
          { value: e.value },
        );
      }
      throw e;
    }

    if (primaryLocationId !== undefined) {
      await this.updateRelation(
        'primaryLocation',
        'Location',
        existing.id,
        primaryLocationId,
        'Project',
      );
      result = {
        ...result,
        primaryLocation: primaryLocationId ? { id: primaryLocationId } : null,
      };
    }

    if (fieldRegionId !== undefined) {
      await this.updateRelation(
        'fieldRegion',
        'FieldRegion',
        existing.id,
        fieldRegionId,
        'Project',
      );
      result = {
        ...result,
        fieldRegion: fieldRegionId ? { id: fieldRegionId } : null,
      };
    }

    if (marketingLocationId !== undefined) {
      await this.updateRelation(
        'marketingLocation',
        'Location',
        existing.id,
        marketingLocationId,
        'Project',
      );
      result = {
        ...result,
        marketingLocation: marketingLocationId
          ? { id: marketingLocationId }
          : null,
      };
    }

    if (marketingRegionOverrideId !== undefined) {
      await this.updateRelation(
        'marketingRegionOverride',
        'Location',
        existing.id,
        marketingRegionOverrideId,
        'Project',
      );
      result = {
        ...result,
        marketingRegionOverride: marketingRegionOverrideId
          ? { id: marketingRegionOverrideId }
          : null,
      };
    }

    return result;
  }

  async list(input: ProjectListInput, session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'Project')
      .with('distinct(node) as node, node as project')
      .match(requestingUser(session))
      .apply(projectFilters(input.filter))
      .apply(this.privileges.for(session, IProject).filterToReadable())
      .apply(sortWith(projectSorters, input))
      .apply(paginate(input, this.hydrate(session.userId)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async getPrimaryOrganizationName(id: ID) {
    const name = await this.db
      .query()
      .match([
        node('project', 'Project', { id }),
        relation('out', '', 'partnership', ACTIVE),
        node('partnership', 'Partnership'),
        relation('out', '', 'primary', ACTIVE),
        node('primary', 'Property', { value: true }),
      ])
      .with('partnership')
      .match([
        node('partnership'),
        relation('out', '', 'partner', ACTIVE),
        node('', 'Partner'),
        relation('out', '', 'organization', ACTIVE),
        node('org', 'Organization'),
        relation('out', '', 'name', ACTIVE),
        node('name', 'Property'),
      ])
      .return<{ name: string }>('name.value as name')
      .map('name')
      .first();
    return name ?? null;
  }

  @OnIndex()
  private createIndexes() {
    return this.getConstraintsFor(IProject);
  }
  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(ProjectNameIndex.create()).run();
  }
}

export const ProjectNameIndex = FullTextIndex({
  indexName: 'ProjectName',
  labels: 'ProjectName',
  properties: 'value',
  analyzer: 'standard-folding',
});

export const projectSorters = defineSorters(IProject, {
  sensitivity: (query) =>
    query
      .apply(matchProjectSens('node', 'sortValue'))
      .return<SortCol>('sortValue'),
  engagements: (query) =>
    query
      .match([
        node('node'),
        relation('out', '', 'engagement'),
        node('engagement', 'LanguageEngagement'),
      ])
      .return<SortCol>('count(engagement) as sortValue'),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'primaryLocation.*': (query, input) => {
    const getPath = (anon = false) => [
      node('project'),
      relation('out', '', 'primaryLocation', ACTIVE),
      node(anon ? '' : 'node'),
    ];
    return query
      .with('node as project')
      .match(getPath())
      .apply(sortWith(locationSorters, input))
      .union()
      .with('node')
      .with('node as project')
      .where(not(path(getPath(true))))
      .return<SortCol>('null as sortValue');
  },
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'primaryPartnership.*': (query, input) => {
    const getPath = (anon = false) => [
      node('project'),
      relation('out', '', 'partnership', ACTIVE),
      node(anon ? '' : 'node', 'Partnership'),
      relation('out', '', 'primary', ACTIVE),
      node('', 'Property', { value: variable('true') }),
    ];
    return query
      .with('node as project')
      .match(getPath())
      .apply(sortWith(partnershipSorters, input))
      .union()
      .with('node')
      .with('node as project')
      .where(not(path(getPath(true))))
      .return<SortCol>('null as sortValue');
  },
});
