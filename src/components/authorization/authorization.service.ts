import { Injectable, NotImplementedException } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generate } from 'shortid';
import { ISession } from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import {
  CreatePermission,
  CreatePermissionOutput,
} from './dto/create-permission.dto';
import {
  CreateSecurityGroup,
  CreateSecurityGroupOutput,
} from './dto/create-security-group.dto';

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  async createPermission(
    session: ISession,
    request: CreatePermission
  ): Promise<CreatePermissionOutput> {
    this.logger.debug('createPermission', request);
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
            id: generate(),
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
      return { success: true, id: result.id };
    }
  }

  async createSecurityGroup(
    session: ISession,
    request: CreateSecurityGroup
  ): Promise<CreateSecurityGroupOutput> {
    this.logger.debug('createSecurityGroup', request);
    const result = await this.db
      .query()
      .match([
        [
          node('sg', 'SecurityGroup', {
            canCreateSecurityGroup: true,
          }),
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

  attachUserToSecurityGroup() {
    throw new NotImplementedException();
  }
  listSecurityGroupsUserIsAdminOf() {
    throw new NotImplementedException();
  }
  listSecurityGroupsUserIsAMemberOf() {
    throw new NotImplementedException();
  }
  listPermissionsInASecurityGroup() {
    throw new NotImplementedException();
  }
  removePermissionFromSecurityGroup() {
    throw new NotImplementedException();
  }
  removeMemberFromSecurityGroup() {
    throw new NotImplementedException();
  }
  promoteMemberToAdminOfSecurityGroup() {
    throw new NotImplementedException();
  }
  promoteMemberToAdminOfBaseNode() {
    throw new NotImplementedException();
  }
  listPermissionsInSecurityGroup() {
    throw new NotImplementedException();
  }
  deleteSecurityGroup() {
    throw new NotImplementedException();
  }
  updateNameOfSecurityGroup() {
    throw new NotImplementedException();
  }
}
