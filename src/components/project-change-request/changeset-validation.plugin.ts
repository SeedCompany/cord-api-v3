import { Plugin } from '@nestjs/graphql';
import { GraphQLRequestContext as RequestContext } from 'apollo-server-core';
import {
  ApolloServerPlugin as ApolloPlugin,
  GraphQLRequestListener as RequestListener,
} from 'apollo-server-plugin-base';
import {
  GqlContextType as ContextType,
  InputException,
  NotFoundException,
} from '../../common';
import { ProjectChangeRequestRepository } from './project-change-request.repository';

/**
 * Validation for changeset mutations
 */
@Plugin()
export class ChangesetValidationPlugin implements ApolloPlugin<ContextType> {
  constructor(private readonly repo: ProjectChangeRequestRepository) {}

  async requestDidStart(
    _context: RequestContext<ContextType>
  ): Promise<RequestListener<ContextType>> {
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
