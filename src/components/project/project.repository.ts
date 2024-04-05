import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
  NotFoundException,
  Sensitivity,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { CommonRepository, ConfigService, OnIndex } from '~/core';
import { ChangesOf, getChanges } from '~/core/database/changes';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchChangesetAndChangedProps,
  matchProjectSens,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '~/core/database/query';
import { Privileges } from '../authorization';
import {
  CreateProject,
  InternshipProject,
  IProject,
  Project,
  ProjectListInput,
  ProjectStep,
  ProjectType,
  stepToStatus,
  TranslationProject,
  UpdateProject,
} from './dto';
import { projectListFilter } from './list-filter.query';

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
            rootDirectory: 'rootDirectory { .id }',
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
    return getChanges(IProject)(currentProject, {
      ...input,
      ...(input.step ? { status: stepToStatus(input.step) } : {}),
    });
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
      departmentId: null,
      tags: input.tags,
      financialReportReceivedAt: input.financialReportReceivedAt,
      financialReportPeriod: input.financialReportPeriod,
      step,
      status: stepToStatus(step),
      modifiedAt: now,
      canDelete: true,
    };

    const result = await this.db
      .query()
      .apply(
        await createNode(
          type === 'Translation' ? TranslationProject : InternshipProject,
          {
            initialProps,
            baseNodeProps: { type },
          },
        ),
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
      .return<{ id: ID }>('node.id as id')
      .first();
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

    let result = await this.db.updateProperties({
      type:
        existing.type === ProjectType.Translation
          ? TranslationProject
          : InternshipProject,
      object: existing,
      changes: simpleChanges,
      changeset,
    });

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
      .matchNode('node', `${input.filter.type ?? ''}Project`)
      .with('distinct(node) as node, node as project')
      .match(requestingUser(session))
      .apply(projectListFilter(input))
      .apply(this.privileges.for(session, IProject).filterToReadable())
      .apply(
        sorting(IProject, input, {
          sensitivity: (query) =>
            query
              .apply(matchProjectSens('node'))
              .return<{ sortValue: string }>('sensitivity as sortValue'),
          engagements: (query) =>
            query
              .match([
                node('node'),
                relation('out', '', 'engagement'),
                node('engagement', 'LanguageEngagement'),
              ])
              .return<{ sortValue: number }>('count(engagement) as sortValue'),
        }),
      )
      .apply(paginate(input, this.hydrate(session.userId)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  @OnIndex()
  private createIndexes() {
    return this.getConstraintsFor(IProject);
  }
}
