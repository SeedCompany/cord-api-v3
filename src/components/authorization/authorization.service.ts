import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { union, without } from 'lodash';
import { generate } from 'shortid';
import {
  ISession,
  ServerException,
  UnauthenticatedException,
  UnauthorizedException,
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
import { Role } from './dto';
import { Powers } from './dto/powers';
import { DbRole, OneBaseNode } from './model';
import {
  Administrator,
  Controller,
  everyRole,
  FieldOperationsDirector,
  FinancialAnalyst,
  ProjectManager,
  RegionalDirector,
} from './roles';

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

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  async processNewBaseNode(
    baseNodeObj: OneBaseNode,
    baseNodeId: string,
    creatorUserId: string
  ) {
    // get or create the role's Admin SG for this base node
    const adminSgId = await this.mergeSecurityGroupForRole(
      baseNodeObj,
      baseNodeId,
      Administrator
    );
    if (adminSgId) {
      // merge member to it
      await this.db
        .query()
        .match([node('sg', 'SecurityGroup', { id: adminSgId })])
        .match([node('user', 'User', { id: creatorUserId })])
        .merge([node('sg'), relation('out', '', 'member'), node('user')])
        .run();
      this.logger.debug('Added user to existing security group', {
        securityGroup: adminSgId,
        userId: creatorUserId,
      });

      // for (const role of everyRole) {
      //   await this.addAllUsersToSgByTheUsersGlobalRole(adminSgId, role.name);
      // }

      // add all admins to this base node
      await this.addAllUsersToSgByTheUsersGlobalRole(
        adminSgId,
        Administrator.name
      );

      // run all rules for all roles on this base node
      await this.runPostBaseNodeCreationRules(baseNodeObj, baseNodeId);

      return true;
    } else {
      throw new ServerException('failed to create SG for role');
    }
  }

  async createSGsForEveryRoleForAllBaseNodes(session: ISession) {
    this.logger.info('begining to create/merge SGs for all base nodes');
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

      for (const role of everyRole) {
        const baseNodeObj = this.getBaseNodeObjUsingLabel(idQuery.labels);
        await this.mergeSecurityGroupForRole(baseNodeObj, idQuery.id, role);
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
    } else if (labels.includes('EthnologuLanguage')) {
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

  private async mergeSecurityGroupForRole(
    baseNodeObj: OneBaseNode,
    baseNodeId: string,
    role: DbRole
  ): Promise<string> {
    /**
     * this creates or merges with the specific SG needed for a given role
     */
    const checkSg = await this.db
      .query()
      .match([
        node('sg', 'SecurityGroup', { role }),
        relation('out', '', 'baseNode'),
        node('baseNode', 'BaseNode', { id: baseNodeId }),
      ])
      .raw('return sg.id as id')
      .asResult<{ id: string }>()
      .first();

    if (checkSg?.id) {
      return checkSg.id;
    }

    // create SG with all role's perms
    const createSgQuery = this.db
      .query()
      .match([node('baseNode', 'BaseNode', { id: baseNodeId })])
      .merge([
        node('sg', 'SecurityGroup', {
          id: generate(),
          role: role.name,
        }),
        relation('out', '', 'baseNode'),
        node('baseNode'),
      ]);

    // iterate through the key of the base node and get the permission object for each from the role object
    for (const key of Object.keys(baseNodeObj)) {
      const perms = role.getPermissionsOnProperty<typeof baseNodeObj>(
        baseNodeObj.__className,
        key as keyof OneBaseNode
      );

      // write the permission to the db if any of its perms are true
      createSgQuery.merge([
        node('sg'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          read: perms?.read ? perms.read : false,
          edit: perms?.write ? perms.write : false,
          property: key,
        }),
        relation('out', '', 'baseNode'),
        node('baseNode'),
      ]);
    }

    const result = await createSgQuery
      .raw('return sg.id as id')
      .asResult<{ id: string }>()
      .first();

    if (result === undefined) {
      throw new ServerException('failed to create SG for role');
    }

    return result.id;
  }

  private async runPostBaseNodeCreationRules(
    baseNodeObj: OneBaseNode,
    baseNodeId: string
  ) {
    /**
     * Remember, this is only run at base node creation,
     * not every rule in the role def applies
     */

    // after a base node is created, only the admin SG is created.
    // this function will create the remaining needed base nodes.

    // certain roles are 'global' in the sense that they get some form
    // of access to each base node. because of that, we don't care what
    // the base node type is, we can just apply the role

    const globalRoles = [
      {
        role: ProjectManager,
        sgId: await this.mergeSecurityGroupForRole(
          baseNodeObj,
          baseNodeId,
          ProjectManager
        ),
      },
      {
        role: RegionalDirector,
        sgId: await this.mergeSecurityGroupForRole(
          baseNodeObj,
          baseNodeId,
          RegionalDirector
        ),
      },
      {
        role: FieldOperationsDirector,
        sgId: await this.mergeSecurityGroupForRole(
          baseNodeObj,
          baseNodeId,
          FieldOperationsDirector
        ),
      },
      {
        role: FinancialAnalyst,
        sgId: await this.mergeSecurityGroupForRole(
          baseNodeObj,
          baseNodeId,
          FinancialAnalyst
        ),
      },
      {
        role: Controller,
        sgId: await this.mergeSecurityGroupForRole(
          baseNodeObj,
          baseNodeId,
          Controller
        ),
      },
    ];

    for (const role of globalRoles) {
      const sgId = await this.mergeSecurityGroupForRole(
        baseNodeObj,
        baseNodeId,
        role.role
      );
      await this.addAllUsersToSgByTheUsersGlobalRole(sgId, role.role.name);
    }

    // create the rest of the SGs needed for each role
    const labels = await this.getLabels(baseNodeId);
    for (const role of everyRole) {
      const baseNodeObj = this.getBaseNodeObjUsingLabel(labels);
      await this.mergeSecurityGroupForRole(baseNodeObj, baseNodeId, role);
    }
  }

  async roleAddedToUser(id: string, roles: string[]) {
    // todo: this only applies to global roles, the only kind we have until next week
    // iterate through all roles and assign to all SGs with that role
    for (const role of roles) {
      await this.db
        .query()
        .raw(
          `
          call apoc.periodic.iterate(
            "MATCH (u:User {id:'${id}'}), (sg:SecurityGroup {role:'${role}'}) RETURN u, sg", 
            "MERGE (u)<-[:member]-(sg)", {batchSize:1000})
          yield batches, total return batches, total
      `
        )
        .run();

      // match the role to a real role object and grant powers
      const roleObj = everyRole.find((i) => i.name === role);
      if (roleObj === undefined) continue;
      for (const power of roleObj.powers) {
        await this.grantPower(power, id);
      }
    }
  }

  private async getLabels(id: string): Promise<string[]> {
    const result = await this.db
      .query()
      .match([node('baseNode', 'BaseNode', { id })])
      .raw('return labels(baseNode) as labels')
      .first();

    if (result === undefined) {
      throw new ServerException('baseNode not found');
    }

    return result.labels;
  }

  private async addAllUsersToSgByTheUsersGlobalRole(sgId: string, role: Role) {
    // grab all users who have a given user-role and add them as members to the new sg
    const sgQuery = this.db
      .query()
      .match([node('sg', 'SecurityGroup', { id: sgId })])
      .match([
        node('users', 'User'),
        relation('out', '', 'roles', { active: true }),
        node('roles', 'Property', { value: role }),
      ])
      .merge([node('users'), relation('in', '', 'member'), node('sg')]);

    await sgQuery.run();
  }

  async checkPower(power: Powers, id?: string): Promise<boolean> {
    // if no id is given we check the public sg for public powers
    let hasPower = false;

    if (id === undefined) {
      const result = await this.db
        .query()
        .match([
          node('sg', 'PublicSecurityGroup', {
            id: this.config.publicSecurityGroup.id,
          }),
        ])
        .raw(`where '${power}' IN sg.powers`)
        .raw(`return "${power}" IN sg.powers as hasPower`)
        .union()
        .match([
          node('user', 'User', {
            id: this.config.anonUser.id,
          }),
        ])
        .raw(`where '${power}' IN user.powers`)
        .raw(`return "${power}" IN user.powers as hasPower`)
        .first();
      hasPower = result?.hasPower ?? false;
    } else {
      const query = this.db
        .query()
        .match([
          node('user', 'User', { id }),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
        ])
        .raw(`where '${power}' IN sg.powers`)
        .raw(`return "${power}" IN sg.powers as hasPower`)
        .union()
        .match([node('user', 'User', { id })])
        .raw(`where '${power}' IN user.powers`)
        .raw(`return "${power}" IN user.powers as hasPower`);

      const result = await query.first();

      hasPower = result?.hasPower ?? false;
    }

    if (!hasPower) {
      throw new UnauthorizedException(
        `user ${id ? id : 'anon'} does not have the requested power: ${power}`
      );
    }

    return hasPower;
  }

  async readPower(session: ISession): Promise<Powers[]> {
    if (!session.userId) {
      return [];
    }
    return await this.readPowerByUserId(session.userId);
  }

  async createPower(
    userId: string,
    power: Powers,
    session: ISession
  ): Promise<void> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }

    const requestingUserPowers = await this.readPowerByUserId(session.userId);
    if (!requestingUserPowers.includes(Powers.GrantPower)) {
      throw new UnauthorizedException(
        'user does not have the power to grant power to others'
      );
    }

    await this.grantPower(power, userId);
  }

  async deletePower(
    userId: string,
    power: Powers,
    session: ISession
  ): Promise<void> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }

    const requestingUserPowers = await this.readPowerByUserId(session.userId);
    if (!requestingUserPowers.includes(Powers.GrantPower)) {
      throw new UnauthorizedException(
        'user does not have the power to remove power from others'
      );
    }

    await this.removePower(power, userId);
  }

  async grantPower(power: Powers, userId: string): Promise<void> {
    const powers = await this.readPowerByUserId(userId);

    const newPowers = union(powers, [power]);
    await this.updateUserPowers(userId, newPowers);
  }

  async removePower(power: Powers, userId: string): Promise<void> {
    const powers = await this.readPowerByUserId(userId);

    const newPowers = without(powers, power);
    await this.updateUserPowers(userId, newPowers);
  }

  private async updateUserPowers(
    userId: string,
    newPowers: Powers[]
  ): Promise<void> {
    const result = await this.db
      .query()
      .optionalMatch([node('userOrSg', 'User', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .with('*')
      .optionalMatch([node('userOrSg', 'SecurityGroup', { id: userId })])
      .setValues({ 'userOrSg.powers': newPowers })
      .run();

    if (!result) {
      throw new ServerException('Failed to grant power');
    }
  }

  private async readPowerByUserId(id: string): Promise<Powers[]> {
    const result = await this.db
      .query()
      .match([node('user', 'User', { id })])
      .raw('return user.powers as powers')
      .unionAll()
      .match([node('sg', 'SecurityGroup', { id })])
      .raw('return sg.powers as powers')
      .asResult<{ powers: Powers[] }>()
      .first();

    if (!result) {
      return [];
    }
    return result.powers;
  }
}
