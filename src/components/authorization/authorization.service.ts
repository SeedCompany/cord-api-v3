import { Injectable } from '@nestjs/common';
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

  async createAuthorization(
    request: CreatePermission
  ): Promise<CreatePermissionOutput> {
    this.logger.debug('createAuthorization', request);
    return { success: true };
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
      .create([
        [
          node('sg', 'SecurityGroup', {
            name: request.name,
            id: generate(),
          }),
        ],
      ])
      .return({ people: [{ id: 'id' }] })
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
}
