import { GraphQLResolveInfo as ResolveInfo } from 'graphql';
import {
  parseResolveInfo,
  ResolveTree,
  simplifyParsedResolveInfoFragmentWithType,
} from 'graphql-parse-resolve-info';
import { LazyGetter } from 'lazy-get-decorator';
import { difference } from 'lodash';
import { LiteralUnion } from 'type-fest';
import { ResourceMap } from '~/core';
import { AbstractClassType } from './types';

/**
 * A helper to query the fields selected of a GraphQL operation.
 *
 * @example
 * ```
 * foo(
 *   @Info(FieldSelection) fields: FieldSelection
 * ) {
 *   if (isOnlyGivenKeys(fields.forType('Language'), ['id']) {
 *     // do shortcut or whatever
 *   }
 * }
 * ```
 */
export class FieldSelection {
  private constructor(
    private readonly tree: ResolveTree,
    private readonly resolveInfo: ResolveInfo,
  ) {}

  static parse(info: ResolveInfo) {
    const tree = parseResolveInfo(info) as ResolveTree;
    return new FieldSelection(tree, info);
  }

  static transform(info: ResolveInfo) {
    return FieldSelection.parse(info);
  }

  /**
   * This just smashes all the fields together into one big map.
   * This is a quick and dirty way to get all the fields requested,
   * regardless of associated type.
   * Just because all these fields are requested, does not mean that they are
   * actually returned.
   * They could be for other types.
   */
  @LazyGetter() get forAllTypes(): FieldInfo<any> {
    return Object.assign({}, ...Object.values(this.byRequestedTypes));
  }

  /**
   * This returns all the requested fields for a given type.
   * This actually figures out fields requested by interfaces,
   * so it works more like you would expect.
   *
   * For example,
   * ```
   * {
   *   Engagement: { id: {...} },
   *   LanguageEngagement: { language: {...} },
   * }
   * ```
   * ```ts
   * Object.keys(forType('LanguageEngagement')) === ['id', 'language']
   * ```
   *
   * This is great too if you know the resolved type to be returned in order
   * to filter out requested but unrelated fields.
   */
  forType<T>(type: AbstractClassType<T>): FieldInfo<T>;
  forType<K extends keyof ResourceMap>(
    type: K,
  ): FieldInfo<ResourceMap[K]['prototype']>;
  forType(type: string | AbstractClassType<any>) {
    const typeName = typeof type === 'string' ? type : type.constructor.name;
    const typeObj = this.resolveInfo.schema.getType(typeName);
    if (!typeObj) {
      return {};
    }
    const { fields } = simplifyParsedResolveInfoFragmentWithType(
      this.tree,
      typeObj,
    );
    return fields;
  }

  /**
   * Returns a map of fields requested in the operation by their requested type.
   * This is fairly low-level, so you probably want to use `forType` instead.
   *
   * For example,
   * ```
   * {
   *   Engagement: { id: {...} },
   *   LanguageEngagement: { language: {...} },
   * }
   * ```
   *
   * So is `LanguageEngagement.id` requested? Yes, but that's not directly
   * represented here.
   */
  get byRequestedTypes(): {
    [Type in keyof ResourceMap]?: FieldInfo<ResourceMap[Type]['prototype']>;
  } {
    return this.tree.fieldsByTypeName;
  }
}

export type FieldInfo<T> = {
  [Field in LiteralUnion<
    keyof T,
    string // Allow other field names because they could be lazy resolvers not on our DTO.
  >]?: ResolveTree;
};

/**
 * A helper to confirm that only the given keys are present on the object.
 */
export const isOnlyGivenKeys = <T extends object>(
  object: T,
  keys: ReadonlyArray<LiteralUnion<keyof T, string>>,
) => difference(Object.keys(object), keys).length === 0;
