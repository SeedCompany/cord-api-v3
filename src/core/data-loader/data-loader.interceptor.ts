import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { ContextIdFactory, ModuleRef } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { ServerException } from '../../common';
import { NEST_LOADER_CONTEXT_KEY } from './constants';
import { NestDataLoader } from './loader.decorator';

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType<GqlContextType>() !== 'graphql') {
      return next.handle();
    }

    const ctx = GqlExecutionContext.create(context).getContext();

    if (ctx[NEST_LOADER_CONTEXT_KEY] === undefined) {
      ctx[NEST_LOADER_CONTEXT_KEY] = {
        contextId: ContextIdFactory.create(),
        getLoader: (type: string): Promise<NestDataLoader<any, any>> => {
          if (ctx[type] === undefined) {
            ctx[type] = (async () => {
              try {
                return (
                  await this.moduleRef.resolve<NestDataLoader<any, any>>(
                    type,
                    ctx[NEST_LOADER_CONTEXT_KEY].contextId,
                    { strict: false }
                  )
                ).generateDataLoader(ctx);
              } catch (e) {
                throw new ServerException(
                  `The loader ${type} is not provided`,
                  e
                );
              }
            })();
          }
          return ctx[type];
        },
      };
    }
    return next.handle();
  }
}
