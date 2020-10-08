import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { difference, union } from 'lodash';
import { generate } from 'shortid';
import {
  InputException,
  ISession,
  ServerException,
  UnauthenticatedException,
  UnauthorizedException,
} from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { Powers } from './dto/powers';
import { DbRole, OneBaseNode } from './model';
import { InternalAdminRole } from './roles';

/**
 * powers can exist on a security group or a user node
 */

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  async addPermsForRole(
    role: DbRole,
    baseNodeObj: OneBaseNode,
    baseNodeId: string,
    userId: string
  ) {
    // check if SG for this role already exists
    const existingGroupId = await this.getSecurityGroupForRole(
      baseNodeId,
      role.name
    );
    if (existingGroupId) {
      // SG exists, merge member to it
      await this.db
        .query()
        .match([node('sg', 'SecurityGroup', { id: existingGroupId })])
        .match([node('user', 'User', { id: userId })])
        .merge([node('sg'), relation('out', '', 'member'), node('user')])
        .call(this.addRootUserForAdminRole, role)
        .run();
      this.logger.debug('Added user to existing security group', {
        securityGroup: existingGroupId,
        userId,
      });

      return;
    }

    // SG does not yet exist, create it and merge user to it
    const createSgQuery = this.db
      .query()
      .match([node('user', 'User', { id: userId })])
      .match([node('baseNode', 'BaseNode', { id: baseNodeId })])
      .merge([
        node('user'),
        relation('in', '', 'member'),
        node('sg', 'SecurityGroup', {
          id: generate(),
          role: role.name,
        }),
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

    createSgQuery.call(this.addRootUserForAdminRole, role);

    await createSgQuery.run();

    this.logger.debug('Created security group', {
      baseNodeObj,
      role,
      userId,
    });

    return true;
  }

  private async getSecurityGroupForRole(baseNodeId: string, role: string) {
    const checkSg = await this.db
      .query()
      .match([
        node('sg', 'SecurityGroup', { role }),
        relation('out', '', 'permission'),
        node('baseNode', 'BaseNode', { id: baseNodeId }),
      ])
      .raw('return sg.id as id')
      .asResult<{ id: string }>()
      .first();
    return checkSg?.id;
  }

  // if this is an admin role, ensure the root user is attached
  private readonly addRootUserForAdminRole = (query: Query, role: DbRole) => {
    if (role.name === InternalAdminRole.name) {
      query
        .with('*')
        .match([node('root', 'User', { id: this.config.rootAdmin.id })])
        .merge([node('sg'), relation('out', '', 'member'), node('root')]);
    }
  };

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
    id: string,
    power: Powers,
    session: ISession
  ): Promise<boolean> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }

    const requestingUserPowers = await this.readPowerByUserId(session.userId);
    if (requestingUserPowers.includes(Powers.GrantPower)) {
      return await this.grantPower(power, id);
    }
    throw new InputException(
      'user does not have the power to grant power to others'
    );
  }

  async deletePower(
    id: string,
    power: Powers,
    session: ISession
  ): Promise<boolean> {
    if (!session.userId) {
      throw new UnauthenticatedException('user not logged in');
    }

    const requestingUserPowers = await this.readPowerByUserId(session.userId);
    if (requestingUserPowers.includes(Powers.GrantPower)) {
      return await this.removePower(power, id);
    }
    throw new InputException(
      'user does not have the power to remove power from others'
    );
  }

  async grantPower(power: Powers, id: string): Promise<boolean> {
    // get powers
    const powers = await this.readPowerByUserId(id);

    if (powers === undefined) {
      throw new UnauthorizedException('user not found');
    } else {
      const newPowers = union(powers, [power]);
      return await this.updateUserPowers(id, newPowers);
    }
  }

  async removePower(power: Powers, id: string): Promise<boolean> {
    // get power
    const powers = await this.readPowerByUserId(id);

    if (powers === undefined) {
      throw new UnauthorizedException('user not found');
    } else {
      const newPowers = difference(powers, [power]);
      return await this.updateUserPowers(id, newPowers);
    }
  }

  async updateUserPowers(id: string, newPowers: Powers[]): Promise<boolean> {
    const result = await this.db
      .query()
      .optionalMatch([node('userOrSg', 'User', { id })])
      .setValues({ 'userOrSg.powers': newPowers })
      .with('*')
      .optionalMatch([node('userOrSg', 'SecurityGroup', { id })])
      .setValues({ 'userOrSg.powers': newPowers })
      .run();

    if (result) {
      return true;
    } else {
      throw new ServerException('failed to grant power');
    }
  }

  async readPowerByUserId(id: string): Promise<Powers[]> {
    const result = await this.db
      .query()
      .match([node('user', 'User', { id })])
      .raw('return user.powers as powers')
      .unionAll()
      .match([node('sg', 'SecurityGroup', { id })])
      .raw('return sg.powers as powers')
      .first();

    if (!result) {
      return [];
    }
    return result.powers as Powers[];
  }
}
