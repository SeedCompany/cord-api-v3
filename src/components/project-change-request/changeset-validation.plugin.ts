import { Plugin } from '@nestjs/graphql';
import { GraphQLRequestContext } from 'apollo-server-core';
import {
  ApolloServerPlugin,
  GraphQLRequestListener,
} from 'apollo-server-plugin-base';
import { InputException, NotFoundException } from '../../common';
import { ProjectChangeRequestRepository } from './project-change-request.repository';

/**
 * Validation for changeset mutations
 */
@Plugin()
export class ChangesetValidationPlugin implements ApolloServerPlugin {
  constructor(private readonly repo: ProjectChangeRequestRepository) {}

  requestDidStart(
    _context: GraphQLRequestContext
  ): GraphQLRequestListener | void {
    return {
      responseForOperation: async ({ request, operation }) => {
        if (operation.operation !== 'mutation') {
          return null;
        }

        // By convention we are assuming changeset ID will be given here
        const changeset = request.variables?.input?.changeset;

        if (!changeset) {
          return null;
        }
        let changeRequest;
        try {
          changeRequest = await this.repo.readOne(changeset);
        } catch (e) {
          if (e instanceof NotFoundException) {
            // Not a problem, just move on.
            return null;
          }
          throw e;
        }
        if (changeRequest.canEdit) {
          return null;
        }

        throw new InputException('Changeset is not pending', 'changeset');
      },
    };
  }
}
