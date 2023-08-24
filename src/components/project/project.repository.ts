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
} from '../../common';
import {
  CommonRepository,
  ConfigService,
  DatabaseService,
  OnIndex,
} from '../../core';
import { DbChanges, getChanges } from '../../core/database/changes';
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
} from '../../core/database/query';
import { Privileges, Role } from '../authorization';
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
    db: DatabaseService,
    private readonly config: ConfigService,
    private readonly privileges: Privileges,
  ) {
    super(db);
  }

  async getRoles(session: Session) {
    const result = await this.db
      .query()
      .match([
        node('user', 'User', { id: session.userId }),
        relation('out', '', 'roles', ACTIVE),
        node('roles', 'Property'),
      ])
      .return<{ roles: Role }>('roles.value as roles')
      .run();
    return result.map((row) => row.roles);
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
            rootDirectory: 'rootDirectory.id',
            primaryLocation: 'primaryLocation.id',
            marketingLocation: 'marketingLocation.id',
            fieldRegion: 'fieldRegion.id',
            owningOrganization: 'organization.id',
            engagementTotal: 'engagementTotal',
            changeset: 'changeset.id',
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
          owningOrganization: ['Organization', this.config.defaultOrg.id],
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .first();
    if (!result) {
      throw new ServerException('Failed to create project');
    }
    return result.id;
  }

  async updateProperties(
    currentProject: UnsecuredDto<Project>,
    simpleChanges: DbChanges<TranslationProject | InternshipProject>,
    changeset?: ID,
  ) {
    return await this.db.updateProperties({
      type:
        currentProject.type === ProjectType.Translation
          ? TranslationProject
          : InternshipProject,
      object: currentProject,
      changes: simpleChanges,
      changeset,
    });
  }

  async updateRelation(
    relationName: string,
    otherLabel: string,
    id: ID,
    otherId: ID | null,
  ) {
    await super.updateRelation(
      relationName,
      otherLabel,
      id,
      otherId,
      'Project',
    );
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
        }),
      )
      .apply(paginate(input, this.hydrate(session.userId)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async getMembershipRoles(projectId: ID | Project, session: Session) {
    const query = this.db
      .query()
      .match([
        node('node', 'Project', { id: projectId }),
        relation('out', '', 'member', ACTIVE),
        node('projectMember', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user', 'User', { id: session.userId }),
      ])
      .match([
        node('projectMember'),
        relation('out', 'r', 'roles', ACTIVE),
        node('roles', 'Property'),
      ])
      .return('collect(roles.value) as memberRoles')
      .asResult<{
        memberRoles: Role[][];
      }>();
    return await query.first();
  }

  @OnIndex()
  private createIndexes() {
    return this.getConstraintsFor(IProject);
  }
}
