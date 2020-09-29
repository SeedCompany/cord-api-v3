import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import { generate } from 'shortid';
import { keys, UnauthorizedException } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { InternalRole, Role as ProjectRole } from './dto';
import { Powers } from './dto/powers';
import { getRolePermissions, hasPerm, Perm, TypeToDto } from './policies';

type Role = ProjectRole | InternalRole;

/**
 * In order to use the new Security API (this handler) you must:
 * 1. Ensure the base node type has been added to the ../utility/BaseNodeType.ts enum
 *    ...then -> Add an if/else entry below to assert the type of your new base node
 * 2. Update the ../utility/RolePermission.ts file with your new permissions arrays
 * 3. Publish your role change event in your service file
 * 4. Voila, security groups and permission nodes will be created and attached to your user.
 */

@Injectable()
export class AuthorizationService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('authorization:service') private readonly logger: ILogger
  ) {}

  async addPermsForRole<Type extends keyof TypeToDto>(
    role: Role,
    type: Type,
    dtoOrId: TypeToDto[Type] | string,
    userId: string
  ) {
    const id = typeof dtoOrId === 'string' ? dtoOrId : dtoOrId.id;
    const dto = typeof dtoOrId === 'string' ? undefined : dtoOrId;

    // check if SG for this role already exists
    const existingGroupId = await this.getSecurityGroupForRole(id, role);
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

    const permissions = getRolePermissions(type, role, dto);
    const readProps = keys(
      pickBy(permissions, (perm) => hasPerm(perm, Perm.Read))
    );
    const editProps = keys(
      pickBy(permissions, (perm) => hasPerm(perm, Perm.Edit))
    );

    // SG does not yet exist, create it and merge user to it
    const createSgQuery = this.db
      .query()
      .match([node('user', 'User', { id: userId })])
      .match([node('baseNode', 'BaseNode', { id })])
      .merge([
        node('user'),
        relation('in', '', 'member'),
        node('sg', 'SecurityGroup', {
          id: generate(),
          role,
        }),
      ]);

    for (const perm of editProps) {
      createSgQuery.merge([
        node('sg'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          read: true,
          edit: true,
          property: perm,
        }),
        relation('out', '', 'baseNode'),
        node('baseNode'),
      ]);
    }

    for (const perm of readProps) {
      createSgQuery.merge([
        node('sg'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          read: true,
          edit: false,
          property: perm,
        }),
        relation('out', '', 'baseNode'),
        node('baseNode'),
      ]);
    }

    createSgQuery.call(this.addRootUserForAdminRole, role);

    await createSgQuery.run();

    this.logger.debug('Created security group', {
      type,
      role,
      userId,
      dto,
      id,
    });
  }

  private async getSecurityGroupForRole(baseNodeId: string, role: Role) {
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
  private readonly addRootUserForAdminRole = (query: Query, role: Role) => {
    if (role !== InternalRole.Admin) {
      return;
    }
    query
      .with('*')
      .match([node('root', 'User', { id: this.config.rootAdmin.id })])
      .merge([node('sg'), relation('out', '', 'member'), node('root')]);
  };

  async checkPower(power: Powers, id?: string) {
    // if no id is given we check the public sg for public powers
    let hasPower = false;

    if (id === undefined) {
      const result = await this.db
        .query()
        .match([
          node('sg', 'PublicSecurityGroup', {
            id: this.config.publicSecurityGroup,
          }),
        ])
        .raw(`where '${power}' IN sg.powers`)
        .raw(`return "${power}" IN sg.powers as hasPower`)
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
        .raw(`return "${power}" IN sg.powers as hasPower`);

      const result = await query.first();

      hasPower = result?.hasPower ?? false;
    }

    if (!hasPower) {
      throw new UnauthorizedException('user does not have the requested power');
    }
  }
}
