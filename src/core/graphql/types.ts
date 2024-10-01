/* eslint-disable @typescript-eslint/method-signature-style */

import type { GqlContextType as GqlRequestType } from '@nestjs/graphql/dist/services/gql-execution-context';
import type { GraphQLResolveInfo } from 'graphql';
import type { GqlContextType } from '~/common';

type AllRequestTypes = GqlRequestType;

declare module '@nestjs/common/interfaces/features/arguments-host.interface' {
  export interface ArgumentsHost {
    getType(): AllRequestTypes;
  }
}

declare module '@nestjs/core/helpers/execution-context-host' {
  export interface ExecutionContextHost {
    getType(): AllRequestTypes;
  }
}

declare module '@nestjs/graphql' {
  export interface GqlExecutionContext {
    getContext(): GqlContextType;
    getInfo(): GraphQLResolveInfo;
  }
}
