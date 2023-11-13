import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { from, lastValueFrom } from 'rxjs';
import { RollbackManager } from './rollback-manager';

/**
 * Run all mutations in a transaction.
 * This allows automatic rollbacks on error.
 */
@Injectable()
export abstract class TransactionalMutationsInterceptor
  implements NestInterceptor
{
  constructor(private readonly rollbacks: RollbackManager) {}

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
      this.inTx(async () => {
        try {
          return await lastValueFrom(next.handle());
        } catch (e) {
          await this.rollbacks.runAndClear();
          throw e;
        }
      }),
    );
  }

  protected abstract inTx<R>(fn: () => Promise<R>): Promise<R>;
}
