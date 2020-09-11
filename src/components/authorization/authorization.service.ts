import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generate } from 'shortid';
import { ISession, NotFoundException, ServerException } from '../../common';
import {
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
  OnIndex,
} from '../../core';
import { AddPropertyToSecurityGroup } from './dto/add-property-to-security-group.dto';
import { AttachUserToSecurityGroup } from './dto/attach-user-to-security-group.dto';
import {
  CreatePermission,
  CreatePermissionOutput,
} from './dto/create-permission.dto';
import {
  CreateSecurityGroup,
  CreateSecurityGroupOutput,
} from './dto/create-security-group.dto';
import {
  ListPermissionInput,
  ListPermissionOutput,
} from './dto/list-permission.dto';
import {
  ListSecurityGroupInput,
  ListSecurityGroupOutput,
} from './dto/list-security-group.dto';
import { Permission } from './dto/permission.dto';
import { PromoteUserToAdminOfBaseNode } from './dto/promote-user-to-admin-base-node.dto';
import { PromoteUserToAdminOfSecurityGroup } from './dto/promote-user-to-admin-security-group.dto';
import { RemovePermissionFromSecurityGroup } from './dto/remove-permission-from-security-group.dto';
import { RemoveUserFromSecurityGroup } from './dto/remove-user-from-security-group.dto';
import { SecurityGroup } from './dto/security-group.dto';
import {
  UpdateSecurityGroupName,
  UpdateSecurityGroupNameOutput,
} from './dto/update-security-group-name.dto';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:SecurityGroup) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:SecurityGroup) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:SecurityGroup) ASSERT EXISTS(n.active)',
      'CREATE CONSTRAINT ON (n:SecurityGroup) ASSERT EXISTS(n.createdAt)',
    ];
  }

  async listSecurityGroupsUserIsMemberOf(
    input: ListSecurityGroupInput,
    _session: ISession
  ): Promise<ListSecurityGroupOutput> {
    // TODO: how does "session" play a role here? Should we be filtering SGs by session.token's access?
    const result = (await this.db
      .query()
      .match([
        [
          node('user', 'User', {
            id: input.userId,
          }),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
        ],
      ])
      .return({
        sg: [{ id: 'id', name: 'name' }],
      })
      .run()) as SecurityGroup[];

    // ensure only SGs come through and not root SGs
    return { items: result.filter((item) => item.id && item.name) };
  }

  async listSecurityGroupsUserIsAdminOf(
    input: ListSecurityGroupInput,
    _session: ISession
  ): Promise<ListSecurityGroupOutput> {
    // TODO: how does "session" play a role here? Should we be filtering SGs by session.token's access?
    const result = (await this.db
      .query()
      .match([
        [
          node('user', 'User', {
            id: input.userId,
          }),
          relation('in', '', 'member', {
            admin: true,
          }),
          node('sg', 'SecurityGroup'),
        ],
      ])
      .return({
        sg: [{ id: 'id', name: 'name' }],
      })
      .run()) as SecurityGroup[];

    // ensure only SGs come through and not root SGs
    return { items: result.filter((item) => item.id && item.name) };
  }

  async listPermissionsInSecurityGroup(
    input: ListPermissionInput,
    _session: ISession
  ): Promise<ListPermissionOutput> {
    // TODO: how does "session" play a role here? Should we be filtering SGs by session.token's access?
    const items = (await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            id: input.sgId,
          }),
          relation('out', '', 'permission'),
          node('permission', 'Permission'),
        ],
      ])
      .return({
        permission: [
          { id: 'id', property: 'property', read: 'read', write: 'write' },
        ],
      })
      .run()) as Permission[];

    return { items };
  }

  async createPermission(
    request: CreatePermission,
    session: ISession
  ): Promise<CreatePermissionOutput> {
    // this function is currently deprecated.  It is part of an old idea where there were admins on basenodes
    // permissions are created at the time of creation of a baseNode now.
    this.logger.debug('createPermission', request);

    const id = generate();

    /**
     * In order to be able to add a permission to a security
     * group, you need to be
     * 1. An admin on the base node
     * 2. An admin on the security group
     */
    const result = await this.db
      .query()
      .match([
        [
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
          relation('in', '', 'token', {
            active: true,
          }),
          node('user', 'User'),
          relation('in', '', 'admin', {
            active: true,
          }),
          node('baseNode', 'BaseNode', {
            id: request.baseNodeId,
          }),
        ],
        [
          node('sg', 'SecurityGroup', {
            id: request.sgId,
          }),
        ],
      ])
      .merge([
        [
          node('sg'),
          relation('out', '', 'permission'),
          node('permission', 'Permission', {
            id,
            property: request.propertyName,
            read: request.read,
            write: request.write,
          }),
          relation('out', '', 'baseNode'),
          node('baseNode'),
        ],
      ])
      .return({ permission: [{ id: 'id' }] })
      .first();

    if (result === undefined) {
      return { success: false, id: null };
    } else {
      return { success: true, id };
    }
  }

  async createSecurityGroup(
    request: CreateSecurityGroup,
    session: ISession
  ): Promise<CreateSecurityGroupOutput> {
    const result = await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {}),
          relation('out', '', 'member'),
          node('user', 'User'),
          relation('out', '', 'token', {
            active: true,
          }),
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
        ],
      ])
      .merge([
        [
          node('newSg', 'SecurityGroup', {
            name: request.name,
            id: generate(),
          }),
          relation('out', '', 'member', {
            admin: true,
          }),
          node('user'),
        ],
      ])
      .return({ newSg: [{ id: 'id' }] })
      .first();

    if (result === undefined) {
      return {
        success: false,
        id: null,
      };
    } else {
      return {
        success: true,
        id: result.id,
      };
    }
  }

  async addPropertyToSecurityGroup(
    request: AddPropertyToSecurityGroup,
    session: ISession
  ): Promise<boolean> {
    this.logger.debug('addPropertiesToSecurityGroup', request);

    const result = await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            canAddSgProperties: true,
          }),
          relation('out', '', 'member'),
          node('requestingUser', 'User'),
          relation('out', '', 'token', {
            active: true,
          }),
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
        ],
        [
          node('newSg', 'SecurityGroup', {
            id: request.sgId,
          }),
          relation('out', '', 'member', {
            admin: true,
          }),
          node('requestingUser', 'User'),
        ],
      ])
      .setValues({
        newSg: { [request.property]: true, id: request.sgId },
      })
      .return('newSg')
      .first();

    if (
      !result ||
      result.newSg.properties.id !== request.sgId ||
      !result.newSg.properties[request.property]
    ) {
      return false;
    }

    return true;
  }

  async attachUserToSecurityGroup(
    request: AttachUserToSecurityGroup,
    session: ISession
  ): Promise<boolean> {
    /**
     * In order to be able to add a attach a user to a security group
     * group, you need to be an admin on the security group
     */
    await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            id: request.sgId,
          }),
          relation('out', '', 'member', {
            admin: true,
          }),
          node('requestingUser', 'User'),
          relation('out', '', 'token', {
            active: true,
          }),
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
        ],
        [
          node('user', 'User', {
            id: request.userId,
          }),
        ],
      ])
      .merge([[node('sg'), relation('out', '', 'member'), node('user')]])
      .first();

    const result = await this.getSecurityGroupMember(
      request.sgId,
      request.userId
    );

    if (!result || !result.sgId || !result.userId) {
      return false;
    }

    return true;
  }

  async removePermissionFromSecurityGroup(
    request: RemovePermissionFromSecurityGroup,
    session: ISession
  ): Promise<boolean> {
    /**
     * In order to be able to remove a permission from a security
     * group, you need to be an admin on the base node
     */
    const result = await this.db
      .query()
      .match([
        [
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
          relation('in', '', 'token', {
            active: true,
          }),
          node('user', 'User'),
          relation('in', '', 'admin', {
            active: true,
          }),
          node('baseNode', 'BaseNode', {
            id: request.baseNodeId,
          }),
          relation('in', '', 'baseNode'),
          node('permission', 'Permission', {
            id: request.id,
          }),
          relation('in', '', 'permission'),
          node('sg', 'SecurityGroup', {
            id: request.sgId,
          }),
        ],
      ])
      .with(['permission', { 'permission.id': 'permissionId' }])
      .detachDelete('permission')
      .return('permissionId')
      .first();

    if (result === undefined || !result.permissionId) {
      return false;
    }

    return true;
  }

  async removeUserFromSecurityGroup(
    request: RemoveUserFromSecurityGroup,
    session: ISession
  ): Promise<boolean> {
    const member = await this.getSecurityGroupMember(
      request.sgId,
      request.userId
    );

    if (!member) {
      throw new NotFoundException(
        'User and Security Group association not found'
      );
    }

    /**
     * In order to be able to add a remove a user from a security group
     * group, you need to be an admin on the security group
     */
    await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            id: request.sgId,
          }),
          relation('out', '', 'member', {
            admin: true,
          }),
          node('requestingUser', 'User'),
          relation('out', '', 'token', {
            active: true,
          }),
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
        ],
        [
          node('user', 'User', {
            id: request.userId,
          }),
          relation('in', 'm', 'member'),
          node('sg'),
        ],
      ])
      .delete('m')
      .run();

    const result = await this.getSecurityGroupMember(
      request.sgId,
      request.userId
    );

    if (!result) {
      return true;
    }

    return false;
  }

  async promoteUserToAdminOfSecurityGroup(
    request: PromoteUserToAdminOfSecurityGroup,
    session: ISession
  ): Promise<boolean> {
    /**
     * In order to be able to add a attach a user to a security group
     * group, you need to be an admin on the security group
     */
    await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            id: request.sgId,
          }),
          relation('out', '', 'member', {
            admin: true,
          }),
          node('requestingUser', 'User'),
          relation('out', '', 'token', {
            active: true,
          }),
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
        ],
        [
          node('user', 'User', {
            id: request.userId,
          }),
          relation('in', 'm', 'member'),
          node('sg'),
        ],
      ])
      .set({
        values: {
          'm.admin': true,
        },
      })
      .first();

    const result = await this.getSecurityGroupMember(
      request.sgId,
      request.userId
    );

    if (!result || !result.sgId || !result.userId || !result.admin) {
      return false;
    }

    return true;
  }

  async promoteUserToAdminOfBaseNode(
    request: PromoteUserToAdminOfBaseNode,
    session: ISession
  ): Promise<boolean> {
    /**
     * In order to be able to promote user to an admin on a base node,
     * the requesting user must be an admin on the base node
     */
    await this.db
      .query()
      .match([
        [
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
          relation('in', '', 'token', {
            active: true,
          }),
          node('requestingUser', 'User'),
          relation('in', '', 'admin', {
            active: true,
          }),
          node('accessBaseNode', 'BaseNode', {
            id: request.baseNodeId,
          }),
        ],
        [
          node('user', 'User', {
            id: request.userId,
          }),
        ],
        [
          node('baseNode', 'BaseNode', {
            id: request.baseNodeId,
          }),
        ],
      ])
      .merge([
        node('user'),
        relation('in', '', 'admin', {
          active: true,
        }),
        node('baseNode'),
      ])
      .run();

    const result = await this.db
      .query()
      .match([
        [
          node('user', 'User', {
            id: request.userId,
          }),
          relation('in', 'a', 'admin', {
            active: true,
          }),
          node('baseNode', 'BaseNode', {
            id: request.baseNodeId,
          }),
        ],
      ])
      .return({
        user: [{ id: 'userId' }],
        baseNode: [{ id: 'baseNodeId' }],
        a: [{ active: 'adminActive' }],
      })
      .first();

    if (
      !result ||
      !result.adminActive ||
      result.userId !== request.userId ||
      result.baseNodeId !== request.baseNodeId
    ) {
      return false;
    }

    return true;
  }

  async deleteSecurityGroup(id: string, session: ISession): Promise<void> {
    try {
      await this.db
        .query()
        .match([
          [
            ...matchSession(session),
            relation('in', '', 'member', {
              admin: true,
            }),
            node('sg', 'SecurityGroup', {
              id,
            }),
          ],
        ])
        .detachDelete('sg')
        .run();
    } catch (exception) {
      this.logger.warning('Failed to delete security group', {
        exception,
      });
      throw new ServerException('Failed to delete security group', exception);
    }
  }

  async updateSecurityGroupName(
    request: UpdateSecurityGroupName,
    session: ISession
  ): Promise<UpdateSecurityGroupNameOutput> {
    /**
     * In order to be able to update a security group name
     *you need to be an admin on the security group
     */
    await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            id: request.id,
          }),
          relation('out', '', 'member', {
            admin: true,
          }),
          node('requestingUser', 'User'),
          relation('out', '', 'token', {
            active: true,
          }),
          node('token', 'Token', {
            active: true,
            value: session.token,
          }),
        ],
      ])
      .set({
        values: {
          'sg.name': request.name,
        },
      })
      .run();

    const result = await this.getSecurityGroupMember(
      request.id,
      session.userId!
    );

    if (
      !result ||
      !result.sgId ||
      !result.sgName ||
      result.sgName !== request.name
    ) {
      if (!result?.admin) {
        throw new ServerException(
          'You do not have permission to update this security group'
        );
      }

      throw new ServerException('Security group name could not be updated');
    }

    return {
      id: result.sgId,
      name: result.sgName,
    };
  }

  private async getSecurityGroupMember(
    sgId: string,
    userId: string
  ): Promise<{
    sgId?: string;
    sgName?: string;
    userId?: string;
    admin?: boolean;
  } | null> {
    const result = await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            id: sgId,
          }),
          relation('out', 'm', 'member'),
          node('user', 'User', {
            id: userId,
          }),
        ],
      ])
      .return({
        sg: [{ id: 'sgId', name: 'sgName' }],
        user: [{ id: 'userId' }],
        m: [{ admin: 'admin' }],
      })
      .first();

    return result
      ? {
          sgId: result.sgId,
          sgName: result.sgName,
          userId: result.userId,
          admin: result.admin,
        }
      : null;
  }
}
