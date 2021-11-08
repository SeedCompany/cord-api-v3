import { FieldMiddleware } from '@nestjs/graphql';
import { isObject } from 'lodash';
import { ServerException } from './exceptions';
import type { ID } from './id-field';

/**
 * This field middleware sets the parentId property on the field.
 * Useful to allow field resolvers access to the ID of the containing object.
 */
export const parentIdMiddleware: FieldMiddleware = async (
  { source, info },
  next
) => {
  const value = await next();
  if (!source.id) {
    throw new ServerException(
      `Cannot determine ID for ${info.parentType.name}`
    );
  }
  if (value) {
    if (!isObject(value)) {
      throw new ServerException(
        `Cannot set parent ID on ${info.parentType.name}.${info.fieldName} because it is not an object.`
      );
    }
    (value as { parentId: ID }).parentId = source.id;
    if ('changeset' in source) {
      (value as { changeset?: ID }).changeset = source.changeset;
    }
  }
  return value;
};
