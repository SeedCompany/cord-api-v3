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
  matchProjectSensToLimitedScopeMap,
  matchProps,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  paginate,
  requestingUser,
  sorting,
} from '../../core/database/query';
import { DbPropsOfDto } from '../../core/database/results';
import { Role } from '../authorization';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
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
import { projectListFilter } from './query.helpers';

@Injectable()
export class ProjectRepository extends CommonRepository {
  constructor(db: DatabaseService, private readonly config: ConfigService) {
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
        .return<{ dto: UnsecuredDto<Project> }>(
          merge('props', 'changedProps', {
            type: 'node.type',
            pinned: 'exists((:User { id: $requestingUser })-[:pinned]->(node))',
            rootDirectory: 'rootDirectory.id',
            primaryLocation: 'primaryLocation.id',
            marketingLocation: 'marketingLocation.id',
            fieldRegion: 'fieldRegion.id',
            owningOrganization: 'organization.id',
            changeset: 'changeset.id',
          }).as('dto')
        );
  }

  getActualChanges(
    currentProject: UnsecuredDto<Project>,
    input: UpdateProject
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
          }
        )
      )
      .apply(
        createRelationships(IProject, 'out', {
          fieldRegion: ['FieldRegion', fieldRegionId],
          primaryLocation: ['Location', primaryLocationId],
          otherLocations: ['Location', otherLocationIds],
          marketingLocation: ['Location', marketingLocationId],
          owningOrganization: ['Organization', this.config.defaultOrg.id],
        })
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
    changeset?: ID
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
    otherId: ID | null
  ) {
    await super.updateRelation(
      relationName,
      otherLabel,
      id,
      otherId,
      'Project'
    );
  }

  async list(
    { filter, ...input }: ProjectListInput,
    session: Session,
    limitedScope?: AuthSensitivityMapping
  ) {
    const result = await this.db
      .query()
      .matchNode('node', `${filter.type ?? ''}Project`)
      .with('distinct(node) as node, node as project')
      .match(requestingUser(session))
      .apply(projectListFilter(filter))
      .apply(matchProjectSensToLimitedScopeMap(limitedScope))
      .apply(
        sorting(IProject, input, {
          sensitivity: (query) =>
            query
              .apply(matchProjectSens('node'))
              .return<{ sortValue: string }>('sensitivity as sortValue'),
        })
      )
      .apply(paginate(input, this.hydrate(session.userId)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async permissionsForListProp(prop: string, id: ID, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session)])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfReadSecurityGroup', 'member'),
          node('readSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgReadPerms', 'permission'),
          node('canRead', 'Permission', {
            property: prop,
            read: true,
          }),
          relation('out', 'readPermsOfBaseNode', 'baseNode'),
          node('project', 'Project', { id: id }),
        ],
      ])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfEditSecurityGroup', 'member'),
          node('editSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgEditPerms', 'permission'),
          node('canEdit', 'Permission', {
            property: prop,
            edit: true,
          }),
          relation('out', 'editPermsOfBaseNode', 'baseNode'),
          node('project'),
        ],
      ])
      .return(['canRead.read as canRead', 'canEdit.edit as canCreate'])
      .asResult<{ canRead: boolean; canCreate: boolean }>()
      .first();
    return result ?? { canRead: false, canCreate: false };
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

  async getChangesetProps(changeset: ID) {
    const query = this.db
      .query()
      .match([
        node('node', 'Project'),
        relation('out', '', 'changeset', ACTIVE),
        node('changeset', 'Changeset', { id: changeset }),
      ])
      .apply(matchProps({ view: { changeset }, optional: true }))
      .return<{
        props: Partial<DbPropsOfDto<Project>> & {
          id: ID;
          createdAt: DateTime;
          type: ProjectType;
        };
      }>(['props']);

    const result = await query.first();
    return result?.props;
  }

  @OnIndex()
  private createIndexes() {
    return this.getConstraintsFor(IProject);
  }
}
