import type { FieldMiddleware } from '@nestjs/graphql';
import { createGqlPipesParamDecorator } from '@nestjs/graphql/dist/decorators/param.utils.js';
import { GqlParamtype } from '@nestjs/graphql/dist/enums/gql-paramtype.enum.js';
import { isRegularObject } from '@seedcompany/common';
import { ServerException } from '~/common/exceptions';

const store = new WeakMap<object, object>();

const get = <T>(value: object): T => {
  const grandparent = store.get(value);
  if (!grandparent) {
    throw new ServerException('Cannot find grandparent');
  }
  return grandparent as T;
};

const middleware: FieldMiddleware = async ({ source, info }, next) => {
  const value = await next();
  if (value) {
    if (!isRegularObject(value)) {
      throw new ServerException(
        `Cannot store ${info.parentType.name}.${info.fieldName} for grandparent lookup because it is not an object.`,
      );
    }
    store.set(value, source);
  }
  return value;
};

const PipeableParent = createGqlPipesParamDecorator(GqlParamtype.ROOT);

/**
 * @example
 * ```ts
 * class X {
 *   @Field({ middleware: [Grandparent.store] })
 *   y: SecuredY;
 * }
 * ```
 * ```ts
 * @Resolver(SecuredY)
 * class Resolver {
 *   @ResolveField()
 *   z(
 *     @Grandparent() x: X
 *   ) {}
 * }
 * ```
 */
export const Grandparent = () => PipeableParent({ transform: get });
Grandparent.store = middleware;
