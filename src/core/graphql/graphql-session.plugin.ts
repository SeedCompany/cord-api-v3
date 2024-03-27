import {
  ApolloServerPlugin as ApolloPlugin,
  GraphQLRequestContext as RequestContext,
  GraphQLRequestListener as RequestListener,
  GraphQLRequestContextWillSendResponse as WillSendResponse,
} from '@apollo/server';
import { Plugin } from '@nestjs/apollo';
import { GqlContextType as ContextType } from '~/common';

@Plugin()
export class GraphqlSessionPlugin implements ApolloPlugin<ContextType> {
  async requestDidStart(
    _context: RequestContext<ContextType>,
  ): Promise<RequestListener<ContextType>> {
    return {
      async willSendResponse(context: WillSendResponse<ContextType>) {
        // I suspect this is important to ensure that subscriptions
        // will close without burdening the subscribers to do so.
        context.contextValue.session$.complete();
      },
    };
  }
}
