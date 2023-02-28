import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import {
  getNamedType,
  GraphQLInterfaceType,
  GraphQLResolveInfo,
  isAbstractType,
  isCompositeType,
  isInterfaceType,
} from 'graphql';
import { parseResolveInfo, ResolveTree } from 'graphql-parse-resolve-info';
import { difference, pick } from 'lodash';
import type { ChangesetAware } from '../components/changeset/dto';
import type { Resource } from './resource.dto';

export type FieldInfo<T> = Partial<Record<keyof T, ResolveTree>>;

/**
 * Returns the fields requested by the operation (requester).
 * @example
 * ```
 * @Info(Fields) fields: FieldInfo<Foo>
 * ```
 */
export class Fields<T>
  implements PipeTransform<GraphQLResolveInfo, FieldInfo<T>>
{
  transform(info: GraphQLResolveInfo, _metadata: ArgumentMetadata) {
    const { fieldsByTypeName } = parseResolveInfo(info) as ResolveTree;

    // Below is our own implementation of simplifyParsedResolveInfoFragmentWithType
    // Ours includes all fields from all possible output types
    const strippedType = getNamedType(info.returnType);
    if (!isCompositeType(strippedType)) {
      return {};
    }
    const parents = isInterfaceType(strippedType)
      ? getInterfacesDeep(strippedType).map((t) => t.name)
      : [];
    const children = isAbstractType(strippedType)
      ? info.schema.getPossibleTypes(strippedType).map((t) => t.name)
      : [];
    const allTypes = [strippedType.name, ...parents, ...children];

    const fieldsByFilteredTypes = pick(fieldsByTypeName, allTypes);
    const merged = Object.assign({}, ...Object.values(fieldsByFilteredTypes));

    return merged;
  }
}

// Not sure if this is entirely necessary, I think each interface has a
// flat list of parents. But just to be safe...
const getInterfacesDeep = (
  type: GraphQLInterfaceType,
): GraphQLInterfaceType[] => [
  type,
  ...type.getInterfaces().flatMap(getInterfacesDeep),
];

/**
 * Converts the field info to a boolean if the only fields asked for are in this list.
 * @example
 * ```
 * @Info(Fields, IsOnly(['id'])) onlyId: boolean
 * ```
 */
export const IsOnly = <T>(
  fields: Array<keyof T & string>,
): PipeTransform<FieldInfo<T>, boolean> => ({
  transform: (requested) =>
    difference(Object.keys(requested), fields).length === 0,
});

/**
 * Converts the field info to a boolean if the only field asked for is the ID.
 * @example
 * ```
 * @Info(Fields, IsOnlyId) onlyId: boolean
 * ```
 */
export const IsOnlyId = IsOnly<Resource & ChangesetAware>(['id', 'changeset']);
