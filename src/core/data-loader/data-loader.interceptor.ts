import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  Type,
} from '@nestjs/common';
import { ContextId, ContextIdFactory, ModuleRef } from '@nestjs/core';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { Observable } from 'rxjs';
import { ServerException } from '../../common';
import { NEST_LOADER_CONTEXT_KEY } from './constants';
import { DataLoader, NestDataLoader } from './loader.decorator';

export interface LoaderContextType {
  contextId: ContextId;
  loaders: Map<Type<NestDataLoader<any, any>>, Promise<DataLoader<any, any>>>;
  getLoader: (
    type: Type<NestDataLoader<any, any>>
  ) => Promise<DataLoader<any, any>>;
}

@Injectable()
export class DataLoaderInterceptor implements NestInterceptor {
  constructor(private readonly moduleRef: ModuleRef) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType<GqlContextType>() !== 'graphql') {
      return next.handle();
    }

    const gqlContext = GqlExecutionContext.create(context).getContext();

    if (gqlContext[NEST_LOADER_CONTEXT_KEY] !== undefined) {
      return next.handle();
    }

    const loaderContext: LoaderContextType = {
      contextId: ContextIdFactory.create(),
      loaders: new Map(),
      getLoader: (type) => {
        if (loaderContext.loaders.has(type)) {
          return loaderContext.loaders.get(type)!;
        }
        // set promise in map asap, so the promise doesn't get duplicated
        const promise = (async () => {
          try {
            return (
              await this.moduleRef.resolve<NestDataLoader<any, any>>(
                type,
                loaderContext.contextId,
                { strict: false }
              )
            ).generateDataLoader(gqlContext);
          } catch (e) {
            throw new ServerException(
              `The loader ${type.name} is not provided`,
              e
            );
          }
        })();
        loaderContext.loaders.set(type, promise);
        return promise;
      },
    };

    gqlContext[NEST_LOADER_CONTEXT_KEY] = loaderContext;

    return next.handle();
  }
}
