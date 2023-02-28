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

/**
 * Run all mutations in a neo4j transaction.
 * This allows automatic rollbacks on error.
 */
@Injectable()
export class TransactionalMutationsInterceptor implements NestInterceptor {
  constructor(private readonly db: Connection) {}

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
      this.db.runInTransaction(async () => await lastValueFrom(next.handle())),
    );
  }
}
