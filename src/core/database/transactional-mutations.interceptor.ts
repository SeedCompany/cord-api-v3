import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Connection } from 'cypher-query-builder';
import { GraphQLResolveInfo } from 'graphql';
import { from, lastValueFrom } from 'rxjs';
import { RollbackManager } from './rollback-manager';

/**
 * Run all mutations in a neo4j transaction.
 * This allows automatic rollbacks on error.
 */
@Injectable()
export class TransactionalMutationsInterceptor implements NestInterceptor {
  constructor(
    private readonly db: Connection,
    private readonly rollbacks: RollbackManager,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (context.getType<GqlContextType>() !== 'graphql') {
      return next.handle();
    }

    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo<GraphQLResolveInfo>();
    if (info.operation.operation !== 'mutation') {
      return next.handle();
    }

    return from(
      this.db.runInTransaction(async () => {
        try {
          return await lastValueFrom(next.handle());
        } catch (e) {
          await this.rollbacks.runAndClear();
          throw e;
        }
      }),
    );
  }
}
