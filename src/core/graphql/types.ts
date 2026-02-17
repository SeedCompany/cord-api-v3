/* eslint-disable @typescript-eslint/method-signature-style */

import type { GraphQLResolveInfo } from 'graphql';
import type { GqlContextType } from '~/common';

declare module '~/core/exe-ctx.type' {
  interface DeclareContextTypes {
    graphql: true;
  }
}

declare module '@nestjs/graphql' {
  export interface GqlExecutionContext {
    getContext(): GqlContextType;
    getInfo(): GraphQLResolveInfo;
  }
}
