import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generate } from 'shortid';
import { ServerException } from '../../common';
import { ConfigService, DatabaseService, ILogger, Logger } from '../../core';
import { InternalRole } from './dto';
import { RoleAddEvent } from './events/role-add.event';
import { BaseNodeType } from './utility/BaseNodeType';
import { getRolePermissions } from './utility/RolePermission';

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
    @Logger('role-change-event:handler') private readonly logger: ILogger
  ) {}

  /**
   * 1. check to see if SG for role exists on the base node
   * 2. create if needed, with correct permissions
   * 3. add member to SG
   */

  async addPermsForRole(event: RoleAddEvent) {
    try {
      let sgId;

      // get type of base node
      const baseNodeTypeQuery = await this.db
        .query()
        .match([node('baseNode', 'BaseNode', { id: event.baseNodeId })])
        .raw('return labels(baseNode) as labels')
        .first();

      // set the type so we can call the getRolePermissions function and get the
      // correct permissions for this combination of role and base node.
      let baseNodeType;

      if ((baseNodeTypeQuery?.labels as string[]).includes('Project')) {
        baseNodeType = BaseNodeType.Project;
      } else if (
        (baseNodeTypeQuery?.labels as string[]).includes('ProjectMember')
      ) {
        baseNodeType = BaseNodeType.ProjectMember;
      } else if ((baseNodeTypeQuery?.labels as string[]).includes('User')) {
        baseNodeType = BaseNodeType.User;
      } else if ((baseNodeTypeQuery?.labels as string[]).includes('Budget')) {
        baseNodeType = BaseNodeType.Budget;
      } else if (
        (baseNodeTypeQuery?.labels as string[]).includes('BudgetRecord')
      ) {
        baseNodeType = BaseNodeType.BudgetRecord;
      } else if ((baseNodeTypeQuery?.labels as string[]).includes('Ceremony')) {
        baseNodeType = BaseNodeType.Ceremony;
      } else if (
        (baseNodeTypeQuery?.labels as string[]).includes('LanguageEngagement')
      ) {
        baseNodeType = BaseNodeType.LanguageEngagement;
      } else if (
        (baseNodeTypeQuery?.labels as string[]).includes('InternshipEngagement')
      ) {
        baseNodeType = BaseNodeType.InternshipEngagement;
      } else if ((baseNodeTypeQuery?.labels as string[]).includes('Film')) {
        baseNodeType = BaseNodeType.Film;
      } else if (
        (baseNodeTypeQuery?.labels as string[]).includes('FundingAccount')
      ) {
        baseNodeType = BaseNodeType.FundingAccount;
      } else if ((baseNodeTypeQuery?.labels as string[]).includes('Language')) {
        baseNodeType = BaseNodeType.Language;
      } else if (
        (baseNodeTypeQuery?.labels as string[]).includes('EthnologueLanguage')
      ) {
        baseNodeType = BaseNodeType.EthnologueLanguage;
      } else {
        this.logger.error(baseNodeTypeQuery?.labels);
        throw new ServerException('Base node type not identified');
      }

      const perms = getRolePermissions(event.role, baseNodeType);

      // check if SG for this role already exists
      const checkSg = await this.db
        .query()
        .match([
          node('sg', 'SecurityGroup', {
            role: event.role,
          }),
          relation('out', '', 'permission'),
          node('baseNode', 'BaseNode', { id: event.baseNodeId }),
        ])
        .raw('return sg.id as id')
        .first();

      if (!checkSg?.id) {
        // SG does not yet exist, create it and merge user to it
        sgId = generate();
        const createSgQuery = this.db
          .query()
          .match([node('user', 'User', { id: event.userId })])
          .match([node('baseNode', 'BaseNode', { id: event.baseNodeId })])
          .merge([
            node('user'),
            relation('in', '', 'member'),
            node('sg', 'SecurityGroup', {
              id: sgId,
              role: event.role,
            }),
          ]);

        for (const perm of perms.edit) {
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

        for (const perm of perms.read) {
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

        // if this is an admin role, ensure the root user is attached
        if (event.role === InternalRole.Admin) {
          createSgQuery
            .with('*')
            .match([node('root', 'User', { id: this.config.rootAdmin.id })])
            .merge([node('sg'), relation('out', '', 'member'), node('root')]);
        }

        const createResult = await createSgQuery.run();

        if (createResult) {
          // create SG succeeded
        } else {
          // create SG failed
        }
      } else {
        // SG exists, merge member to it
        sgId = checkSg.id;

        const addUserToSgQuery = this.db
          .query()
          .match([node('sg', 'SecurityGroup', { id: sgId })])
          .match([node('user', 'User', { id: event.userId })])
          .merge([node('sg'), relation('out', '', 'member'), node('user')]);

        // if this is an admin role, ensure the root user is attached
        if (event.role === InternalRole.Admin) {
          addUserToSgQuery
            .with('*')
            .match([node('root', 'User', { id: this.config.rootAdmin.id })])
            .merge([node('sg'), relation('out', '', 'member'), node('root')]);
        }

        const addUserResult = await addUserToSgQuery.run();

        if (addUserResult) {
          // merge succeeded
        } else {
          // merge failed
        }
      }
    } catch (e) {
      this.logger.error('error');
    }
  }
}
