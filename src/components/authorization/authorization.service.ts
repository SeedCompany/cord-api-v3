/* eslint-disable no-case-declarations */
import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { union, without } from 'lodash';
import {
  DbBaseNodeLabel,
  generateId,
  has,
  many,
  Many,
  ServerException,
  Session,
} from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { DbBudget } from '../budget/model';
import { DbBudgetRecord } from '../budget/model/budget-record.model.db';
import { DbCeremony } from '../ceremony/model';
import {
  DbInternshipEngagement,
  DbLanguageEngagement,
} from '../engagement/model';
import { DbFieldRegion } from '../field-region/model';
import { DbFieldZone } from '../field-zone/model';
import { DbDirectory, DbFile } from '../file/model';
import { DbFileVersion } from '../file/model/file-version.model.db';
import { DbFilm } from '../film/model';
import { DbFundingAccount } from '../funding-account/model';
import { DbEthnologueLanguage, DbLanguage } from '../language/model';
import { DbLiteracyMaterial } from '../literacy-material/model';
import { DbLocation } from '../location/model';
import { DbOrganization } from '../organization/model';
import { DbPartner } from '../partner/model';
import { DbPartnership } from '../partnership/model';
import { DbProduct } from '../product/model';
import { DbProject } from '../project/model';
import { DbProjectMember } from '../project/project-member/model';
import { DbSong } from '../song/model';
import { DbStory } from '../story/model';
import { DbEducation, DbUnavailability, DbUser } from '../user/model';
import { InternalRole, Role } from './dto';
import { Powers } from './dto/powers';
import { MissingPowerException } from './missing-power.exception';
import { AnyBaseNode, DbPermission, DbRole, OneBaseNode } from './model';
import * as Roles from './roles';

export const tryFindDbRole = (role: Role) => {
  if (has(role, Roles)) {
    const dbRole = Roles[role];
    if (dbRole instanceof DbRole) {
      return dbRole;
    }
  }
  return undefined;
};

export const findDbRole = (role: Role) => {
  const dbRole = tryFindDbRole(role);
  if (!dbRole) {
    throw new ServerException(`Permissions for role "${role}" were not found`);
  }
  return dbRole;
};

export const permissionFor = (
  roles: Many<Role>,
  baseNode: DbBaseNodeLabel,
  property: string,
  action: keyof DbPermission
) =>
  many(roles).some((role) => {
    const dbRole = findDbRole(role);
    const perm = dbRole.getPermissionsOnProperty(baseNode, property);
    return !!perm?.[action];
  });

/**
 * powers can exist on a security group or a user node
 */

/**
 * Authorization events:
 * 1. base node creation
 *   a. assign all global roles membership for the base node
 *   b. assign any per-object roles membership for the base node
 * 2. adding a project member to a project
 *   a. get the member's project role and assign membership for that project
 * 3. assigning a role to a user
 *   a. assign that user membership to all SGs for their new role.
 */

export interface ProjectChildIds {
  budgets: string[];
  budgetRecords: string[];
  ceremonies: string[];
  internshipEngagements: string[];
  langaugeEngagements: string[];
  members: string[];
  organizations: string[];
  partnerships: string[];
  partners: string[];
  produces: string[];
  products: string[];
  users: string[];
}

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  perm(
    roles: Many<Role>,
    baseNode: DbBaseNodeLabel,
    property: keyof AnyBaseNode,
    action: keyof DbPermission
  ): boolean {
    return permissionFor(roles, baseNode, property, action);
  }

  async processNewBaseNode(
    baseNodeObj: OneBaseNode,
    baseNodeId: string,
    creatorUserId: string
  ) {
    return;
    const label = baseNodeObj.__className.substring(2);
    await this.db
      .query()
      .raw(
        `CALL cord.processNewBaseNode($baseNodeId, $label, $creatorUserId)`,
        {
          baseNodeId,
          label,
          creatorUserId,
        }
      )
      .run();
  }

  async createSGsForEveryRoleForAllBaseNodes(session: Session) {
    this.logger.info('beginning to create/merge SGs for all base nodes');
    if (session.userId !== this.config.rootAdmin.id) {
      return true;
    }
    // loop through every base node and create the SGs for each role
    // we're going to do this in the least memory intensive way,
    // which is also the slowest/spammiest
    const baseNodeCountQuery = await this.db
      .query()
      .match([node('baseNode', 'BaseNode')])
      .raw('return count(baseNode) as total')
      .first();

    if (baseNodeCountQuery === undefined) {
      return true;
    }

    this.logger.info('total base nodes: ', baseNodeCountQuery.total);
    // eslint-disable-next-line no-restricted-syntax
    for (let i = 0; i < baseNodeCountQuery.total; i++) {
      const idQuery = await this.db
        .query()
        .match([node('baseNode', 'BaseNode')])
        .raw(`return baseNode.id as id, labels(baseNode) as labels`)
        .skip(i)
        .limit(1)
        .first();

      if (idQuery === undefined) {
        continue;
      }

      for (const role of Object.values(Roles)) {
        const baseNodeObj = this.getBaseNodeObjUsingLabel(idQuery.labels);
        await this.mergeSecurityGroupForRole(idQuery.id, role, baseNodeObj);
      }
    }

    this.logger.info('SG creation complete');
    return true;
  }

  private getBaseNodeObjUsingLabel(labels: string[]): OneBaseNode {
    if (labels.includes('Budget')) {
      return new DbBudget();
    } else if (labels.includes('BudgetRecord')) {
      return new DbBudgetRecord();
    } else if (labels.includes('Ceremony')) {
      return new DbCeremony();
    } else if (labels.includes('Directory')) {
      return new DbDirectory();
    } else if (labels.includes('Education')) {
      return new DbEducation();
    } else if (labels.includes('EthnologueLanguage')) {
      return new DbEthnologueLanguage();
    } else if (labels.includes('FieldRegion')) {
      return new DbFieldRegion();
    } else if (labels.includes('FieldZone')) {
      return new DbFieldZone();
    } else if (labels.includes('File')) {
      return new DbFile();
    } else if (labels.includes('FileVersion')) {
      return new DbFileVersion();
    } else if (labels.includes('Film')) {
      return new DbFilm();
    } else if (labels.includes('FundingAccount')) {
      return new DbFundingAccount();
    } else if (labels.includes('InternshipEngagement')) {
      return new DbInternshipEngagement();
    } else if (labels.includes('Language')) {
      return new DbLanguage();
    } else if (labels.includes('LanguageEngagement')) {
      return new DbLanguageEngagement();
    } else if (labels.includes('LiteracyMaterial')) {
      return new DbLiteracyMaterial();
    } else if (labels.includes('Location')) {
      return new DbLocation();
    } else if (labels.includes('Organization')) {
      return new DbOrganization();
    } else if (labels.includes('Partner')) {
      return new DbPartner();
    } else if (labels.includes('Partnership')) {
      return new DbPartnership();
    } else if (labels.includes('Product')) {
      return new DbProduct();
    } else if (labels.includes('Project')) {
      return new DbProject();
    } else if (labels.includes('ProjectMember')) {
      return new DbProjectMember();
    } else if (labels.includes('User')) {
      return new DbUser();
    } else if (labels.includes('Unavailability')) {
      return new DbUnavailability();
    } else if (labels.includes('Song')) {
      return new DbSong();
    } else if (labels.includes('Story')) {
      return new DbStory();
    }
    throw new ServerException('base node label not found');
  }

  async unsecureGetProjectIdFromAnyProjectChildNode(
    id: string
  ): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation(
          'out',
          '',
          [
            'budget',
            'record',
            'engagement',
            'ceremony',
            'member',
            'partner',
            'partnership',
            'produces',
            'product',
          ],
          { active: true },
          [1, 3]
        ),
        node('', 'BaseNode', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async readPower(session: Session): Promise<Powers[]> {
    if (session.anonymous) {
      return [];
    }
    return await this.readPowerByUserId(session.userId);
  }

  private async readPowerByUserId(id: string): Promise<Powers[]> {
    const result = await this.db
      .query()
      .match([node('user', 'User', { id })])
      .raw('return user.powers as powers')
      .unionAll()
      .match([node('sg', 'SecurityGroup', { id })])
      .raw('return sg.powers as powers')
      .asResult<{ powers?: Powers[] }>()
      .first();

    for (const role of roles) {
      // match the role to a real role object and grant powers
      const dbRole = tryFindDbRole(role);
      if (dbRole === undefined) continue;
      for (const power of dbRole.powers) {
        await this.grantPower(power, id);
      }
    }
  }

  async checkPower(power: Powers, session: Session): Promise<void> {
    const id = session.userId;

    const query = this.db
      .query()
      .match(
        // if anonymous we check the public sg for public powers
        session.anonymous
          ? [
              node('user', 'User', { id }),
              relation('in', '', 'member'),
              node('sg', 'SecurityGroup'),
            ]
          : [
              node('sg', 'PublicSecurityGroup', {
                id: this.config.publicSecurityGroup.id,
              }),
            ]
      )
      .raw('where $power IN sg.powers', { power })
      .raw('return $power IN sg.powers as hasPower')
      .union()
      .match([node('user', 'User', { id })])
      .raw('where $power IN user.powers')
      .raw('return $power IN user.powers as hasPower')
      .asResult<{ hasPower: boolean }>();

    const result = await query.first();
    const hasPower = result?.hasPower ?? false;

    if (!hasPower) {
      throw new MissingPowerException(
        power,
        `user ${
          session.anonymous ? id : 'anon'
        } does not have the requested power: ${power}`
      );
    }
  }

  async unsecureGetProjectIdByBudgetId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('', 'Budget', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetProjectIdByBudgetRecordId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'budget', { active: true }),
        node('', 'Budget'),
        relation('out', '', 'record', { active: true }),
        node('', 'BudgetRecord', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetProjectIdByCeremonyId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement'),
        relation('out', '', 'ceremony', { active: true }),
        node('', 'Ceremony', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetProjectIdByEngagementId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'Engagement', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetProjectIdByPartnershipId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'partnership', { active: true }),
        node('', 'Partnership', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetProjectIdByProjectMemberId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'member', { active: true }),
        node('', 'ProjectMember', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetProjectIdByProducibleId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'LanguageEngagement'),
        relation('out', '', 'product', { active: true }),
        node('', 'Product'),
        relation('out', '', 'produces', { active: true }),
        node('', 'Producible', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetProjectIdByProductId(id: string): Promise<string> {
    const result = await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement', { active: true }),
        node('', 'LanguageEngagement'),
        relation('out', '', 'product', { active: true }),
        node('', 'Product', { id }),
      ])
      .raw(`RETURN project.id as id`)
      .first();

    return result?.id;
  }

  async unsecureGetAllProjectBaseNodeIds(id: string): Promise<ProjectChildIds> {
    const result = await this.db
      .query()
      .raw(
        `
    match
      (project:Project {id:$id})
    with {} as ids, project

    optional match
      (project)-[:budget {active:true}]->(budget:Budget)-[:record{active:true}]->(budgetRecord:BudgetRecord)
    with
      project,
      ids,
      apoc.map.setKey(ids, "budgets", collect(distinct budget.id)) as id1,
      apoc.map.setKey(ids, "budgetRecords", collect(distinct budgetRecord.id)) as id2
    with apoc.map.mergeList([ids, id1, id2]) as ids, project

    optional match
      (project)-[:partnership{active:true}]->(partnership:Partnership)-[:partner{active:true}]->(partner:Partner)-[:organization{active:true}]->(organization:Organization)
    with
      project,
      ids,
      apoc.map.setKey(ids, "partnerships", collect(distinct partnership.id)) as id1,
      apoc.map.setKey(ids, "partners", collect(distinct partner.id)) as id2,
      apoc.map.setKey(ids, "organizations", collect(distinct organization.id)) as id3
    with apoc.map.mergeList([ids, id1, id2, id3]) as ids, project

    optional match
      (project)-[:engagement{active:true}]->(internshipEngagement:InternshipEngagement)
    with
      project,
      ids,
      apoc.map.setKey(ids, "internshipEngagements", collect(distinct internshipEngagement.id)) as id1
    with apoc.map.mergeList([ids, id1]) as ids, project

    optional match
      (project)-[:engagement{active:true}]->(languageEngagement:LanguageEngagement)
    with
      project,
      ids,
      apoc.map.setKey(ids, "languageEngagements", collect(distinct languageEngagement.id)) as id1
    with apoc.map.mergeList([ids, id1]) as ids, project

    optional match
      (project)-[:engagement{active:true}]->(:Engagement)-[:ceremony{active:true}]->(ceremony:Ceremony)
    with
      project,
      ids,
      apoc.map.setKey(ids, "ceremonies", collect(distinct ceremony.id)) as id1
    with apoc.map.mergeList([ids, id1]) as ids, project

    optional match
      (project)-[:member{active:true}]->(member:ProjectMember)-[:user{active:true}]->(user:User)
    with
      project,
      ids,
      apoc.map.setKey(ids, "members", collect(distinct member.id)) as id1,
      apoc.map.setKey(ids, "users", collect(distinct user.id)) as id2
    with apoc.map.mergeList([ids, id1, id2]) as ids, project

    optional match
      (project)-[:engagement{active:true}]->(:Engagement)-[:product{active:true}]->(product:Product)-[:produces{active:true}]->(produces:Producible)
    with
      project,
      ids,
      apoc.map.setKey(ids, "products", collect(distinct product.id)) as id1,
      apoc.map.setKey(ids, "produces", collect(distinct produces.id)) as id2
    with apoc.map.mergeList([ids, id1, id2]) as ids, project

    return ids
    `,
        { id }
      )
      .first();
    return result?.ids;
  }

  async unsecureGetUserIdByProjectMemberId(id: string): Promise<string> {
    const result = this.db
      .query()
      .match([
        node('user', 'User'),
        relation('in', '', 'user', { active: true }),
        node('', 'ProjectMember', { id }),
      ])
      .raw('RETURN user.id as id');
    const result2 = await result.first();
    return result2?.id;
  }

  async unsecureGetProjectRoles(id: string): Promise<string[]> {
    const result = await this.db
      .query()
      .match([
        node('projectMember', 'ProjectMember', { id }),
        relation('out', '', 'roles', { active: true }),
        node('role', 'Property'),
      ])
      .raw(`RETURN role.value as roles`)
      .first();

    return result?.roles ?? [];
  }

  async getUserRoleObjects(id: string): Promise<DbRole[]> {
    const roleQuery = await this.db
      .query()
      .match([
        node('user', 'User', { id }),
        relation('out', '', 'roles', { active: true }),
        node('role', 'Property'),
      ])
      .raw(`RETURN collect(role.value) as roles`)
      .first();

    const roles = roleQuery?.roles.map((role: string) => {
      return Object.values(Roles).find((roleObj) => role === roleObj.name);
    });

    return roles;
  }
}
