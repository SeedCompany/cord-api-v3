import { Injectable } from '@nestjs/common';
import { Node, node, Relation, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  ID,
  Sensitivity,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  CommonRepository,
  ConfigService,
  DatabaseService,
  matchSession,
} from '../../core';
import { DbChanges, getChanges } from '../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  collect,
  createNode,
  createRelationships,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  BaseNode,
  DbPropsOfDto,
  PropListDbResult,
} from '../../core/database/results';
import { Role } from '../authorization';
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
        relation('out', '', 'roles', { active: true }),
        node('roles', 'Property'),
      ])
      .return<{ roles: Role }>('roles.value as roles')
      .run();
    return result.map((row) => row.roles);
  }

  async readOneUnsecured(id: ID, userId: ID) {
    const query = this.db
      .query()
      .match([node('node', 'Project', { id })])
      .apply(matchPropList)
      .with(['node', 'propList'])
      .optionalMatch([
        [node('user', 'User', { id: userId })],
        [node('projectMember'), relation('out', '', 'user'), node('user')],
        [node('projectMember'), relation('in', '', 'member'), node('node')],
        [
          node('projectMember'),
          relation('out', '', 'roles', { active: true }),
          node('props', 'Property'),
        ],
      ])
      .with([collect('props.value', 'memberRoles'), 'propList', 'node'])
      .optionalMatch([
        node('requestingUser', 'User', { id: userId }),
        relation('out', 'pinnedRel', 'pinned'),
        node('node'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'primaryLocation', { active: true }),
        node('primaryLocation', 'Location'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'marketingLocation', { active: true }),
        node('marketingLocation', 'Location'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'fieldRegion', { active: true }),
        node('fieldRegion', 'FieldRegion'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'owningOrganization', { active: true }),
        node('organization', 'Organization'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'LanguageEngagement'),
        relation('out', '', 'language', { active: true }),
        node('', 'Language'),
        relation('out', '', 'sensitivity', { active: true }),
        node('sensitivity', 'Property'),
      ])
      .return([
        'propList',
        'node',
        'memberRoles',
        'pinnedRel',
        'primaryLocation.id as primaryLocationId',
        'marketingLocation.id as marketingLocationId',
        'fieldRegion.id as fieldRegionId',
        'organization.id as owningOrganizationId',
        'collect(distinct sensitivity.value) as languageSensitivityList',
      ])
      .asResult<{
        node: Node<BaseNode & { type: ProjectType }>;
        propList: PropListDbResult<DbPropsOfDto<Project>>;
        pinnedRel?: Relation;
        primaryLocationId: ID;
        memberRoles: Role[][];
        marketingLocationId: ID;
        fieldRegionId: ID;
        owningOrganizationId: ID;
        languageSensitivityList: Sensitivity[];
      }>();

    return await query.first();
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
      .with('node') // needed between a create & match
      .apply(
        createRelationships('out', {
          FieldRegion: { fieldRegion: fieldRegionId },
          Location: {
            primaryLocation: primaryLocationId,
            otherLocations: otherLocationIds,
            marketingLocation: marketingLocationId,
          },
          Organization: { owningOrganization: this.config.defaultOrg.id },
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
    simpleChanges: DbChanges<TranslationProject | InternshipProject>
  ) {
    return await this.db.updateProperties({
      type:
        currentProject.type === ProjectType.Translation
          ? TranslationProject
          : InternshipProject,
      object: currentProject,
      changes: simpleChanges,
    });
  }

  async updateLocation(input: UpdateProject, createdAt: DateTime) {
    const query = this.db
      .query()
      .match(node('project', 'Project', { id: input.id }))
      .match(node('location', 'Location', { id: input.primaryLocationId }))
      .with('project, location')
      .limit(1)
      .optionalMatch([
        node('project', 'Project', { id: input.id }),
        relation('out', 'oldRel', 'primaryLocation', { active: true }),
        node(''),
      ])
      .setValues({ 'oldRel.active': false })
      .with('project, location')
      .limit(1)
      .create([
        node('project'),
        relation('out', '', 'primaryLocation', {
          active: true,
          createdAt,
        }),
        node('location'),
      ]);

    await query.run();
  }

  async updateFieldRegion(input: UpdateProject, createdAt: DateTime) {
    const query = this.db
      .query()
      .match(node('project', 'Project', { id: input.id }))
      .with('project')
      .limit(1)
      .match([node('region', 'FieldRegion', { id: input.fieldRegionId })])
      .optionalMatch([
        node('project'),
        relation('out', 'oldRel', 'fieldRegion', { active: true }),
        node(''),
      ])
      .setValues({ 'oldRel.active': false })
      .with('project, region')
      .limit(1)
      .create([
        node('project'),
        relation('out', '', 'fieldRegion', {
          active: true,
          createdAt,
        }),
        node('region'),
      ]);

    await query.run();
  }

  list(
    label: string,
    sortBy: string,
    { filter, ...input }: ProjectListInput,
    session: Session
  ) {
    // Subquery to get the sensitivity value for a Translation Project.
    // Get the highest sensitivity of the connected Language Engagement's Language
    // If an Engagement doesn't exist, then default to 3 (high)
    const sensitivitySubquery = `call {
        with node
        optional match (node)-[:engagement { active: true }]->(:LanguageEngagement)-[:language { active: true }]->
        (:Language)-[:sensitivity { active: true }]->(sensitivityProp:Property)
        WITH *, case sensitivityProp.value
          when null then 3
          when 'High' then 3
          when 'Medium' then 2
          when 'Low' then 1
          end as langSensitivityVal
        ORDER BY langSensitivityVal desc
        limit 1
        return langSensitivityVal
        }`;

    // In the first case, if the node is a translation project, use the langSensitivityVal from above.
    // Else use the sensitivity prop value
    const sensitivityCase = `case
        when 'TranslationProject' in labels(node) then langSensitivityVal
        when prop.value = 'High' then 3
        when prop.value = 'Medium' then 2
        when prop.value = 'Low' then 1
        end as sensitivityValue`;

    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode(label)])
      .with('distinct(node) as node, requestingUser')
      .apply(projectListFilter(filter))
      .apply(
        calculateTotalAndPaginateList(IProject, input, (q) =>
          ['id', 'createdAt'].includes(input.sort)
            ? q.with('*').orderBy(`node.${input.sort}`, input.order)
            : q
                .raw(input.sort === 'sensitivity' ? sensitivitySubquery : '')
                .match([
                  node('node'),
                  relation('out', '', input.sort, { active: true }),
                  node('prop', 'Property'),
                ])
                .with([
                  '*',
                  ...(input.sort === 'sensitivity' ? [sensitivityCase] : []),
                ])
                .orderBy(sortBy, input.order)
        )
      );
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
        node('node', 'Project', { projectId }),
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
      .return('collect(roles.value) as memberRoles')
      .asResult<{
        memberRoles: Role[][];
      }>();
    return await query.first();
  }

  async getRootDirectory(projectId: ID, session: Session) {
    return await this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadProjects' }))
      .optionalMatch([
        [
          node('project', 'Project', { id: projectId }),
          relation('out', 'rootDirectory', { active: true }),
          node('directory', 'BaseNode:Directory'),
        ],
      ])
      .return<{ id: ID }>({
        directory: [{ id: 'id' }],
      })
      .first();
  }

  async validateOtherResourceId(id: string, label: string) {
    return await this.db
      .query()
      .match([node('node', label, { id })])
      .return('node')
      .first();
  }
}
