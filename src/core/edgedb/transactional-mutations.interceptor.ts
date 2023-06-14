import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { GraphQLResolveInfo } from 'graphql';
import { from, lastValueFrom } from 'rxjs';
import { ConfigService } from '../config/config.service';
import { TransactionContext } from './transaction.context';

/**
 * Run all mutations in an EdgeDB transaction.
 * This allows automatic rollbacks on error.
 */
@Injectable()
export class TransactionalMutationsInterceptor implements NestInterceptor {
  constructor(
    private readonly context: TransactionContext,
    private readonly config: ConfigService,
  ) {}

  async intercept(context: ExecutionContext, next: CallHandler) {
    if (
      this.config.databaseEngine !== 'edgedb' ||
      context.getType<GqlContextType>() !== 'graphql'
    ) {
      return next.handle();
    }

    const ctx = GqlExecutionContext.create(context);
    const info = ctx.getInfo<GraphQLResolveInfo>();
    if (info.operation.operation !== 'mutation') {
      return next.handle();
    }

    return from(
      this.context.inTx(async () => await lastValueFrom(next.handle())),
    );
  }
}
