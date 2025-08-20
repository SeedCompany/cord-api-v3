import { Injectable } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { asNonEmptyArray, setOf } from '@seedcompany/common';
import { createMetadataDecorator } from '@seedcompany/nest';
import { GraphQLObjectType } from 'graphql';
import type { ValueOf } from 'type-fest';
import {
  type ID,
  many,
  type Many,
  type ObjectView,
  ServerException,
} from '~/common';
import { MetadataDiscovery } from '~/core/discovery';
import { type BaseNode } from '../database/results';
import { ILogger, Logger } from '../logger';
import { type ResourceMap } from './map';
import { ResourcesHost } from './resources.host';

type SomeResource = ValueOf<ResourceMap>;

/**
 * Register this function as the function to use to lookup the given types.
 *
 * WARNING: It's required that the function signature be:
 * ```
 * (id: ID, changeset?: ID) => Promise<Resource>
 * ```
 *
 * {@link ResourceResolver} can be used to invoke this function.
 */
export const HandleIdLookup = createMetadataDecorator({
  setter: (type: Many<SomeResource>) => ({
    types: setOf(many(type).map((cls) => cls.name as keyof ResourceMap)),
  }),
  types: ['method'],
});

/**
 * Allows looking up GraphQL objects from DB Nodes.
 *
 * A direct DB lookup should always be used when possible.
 * When an extra read query is needed anyways this can be used.
 *
 * This will only work for resources that have a
 * {@link HandleIdLookup @HandleIdLookup} defined.
 *
 * As long as the concrete type is known
 * or there's a list with a concrete type mixed with interfaces
 */
@Injectable()
export class ResourceResolver {
  private readonly typeCache = new Map<string, keyof ResourceMap | Error>();

  constructor(
    private readonly discovery: MetadataDiscovery,
    private readonly resourcesHost: ResourcesHost,
    private readonly schemaHost: GraphQLSchemaHost,
    @Logger('resource-resolver') private readonly logger: ILogger,
  ) {}

  /**
   * Lookup a resource from a Neo4j BaseNode.
   */
  async lookupByBaseNode(node: BaseNode, view?: ObjectView) {
    return await this.lookup(node.labels, node.properties.id, view);
  }

  /**
   * Lookup a resource by type and ID.
   *
   * It's expected that possibleTypes is or includes a _single_ concrete type.
   */
  async lookup<TResource extends SomeResource>(
    type: TResource,
    id: ID,
    view?: ObjectView,
  ): Promise<TResource['prototype']>;
  async lookup<TResourceName extends keyof ResourceMap>(
    type: TResourceName,
    id: ID,
    view?: ObjectView,
  ): Promise<ResourceMap[TResourceName]['prototype']>;
  async lookup(
    possibleTypes: Many<string | SomeResource>,
    id: ID,
    view?: ObjectView,
  ): Promise<SomeResource['prototype'] & { __typename: string }>;
  async lookup(
    possibleTypes: Many<string | SomeResource>,
    id: ID,
    view?: ObjectView,
  ): Promise<SomeResource['prototype'] & { __typename: string }> {
    const type = this.resolveType(possibleTypes);
    const discovered = this.discovery
      .discover(HandleIdLookup)
      .methods<
        (id: ID, view?: ObjectView) => Promise<SomeResource['prototype']>
      >();
    const filtered = asNonEmptyArray(
      discovered.filter((f) => f.meta.types.has(type)),
    );
    if (!filtered) {
      throw new ServerException(`Could find resolver for type: ${type}`);
    }
    if (filtered.length > 1) {
      this.logger.warning(`Found more than one resolver for ${type}`);
    }
    const { method } = filtered[0];
    const result = await method(id, view);
    return Object.assign({ __typename: type }, result);
  }

  resolveTypeByBaseNode(node: BaseNode) {
    return this.resolveType(node.labels);
  }

  resolveType(types: Many<string | SomeResource>): keyof ResourceMap {
    // This caching may not improve performance much...
    const normalized = many(types).map((t) =>
      typeof t === 'string' ? t : t.name,
    );
    const cacheKey = normalized.join(';');
    const type = this.typeCache.get(cacheKey);
    if (type) {
      if (type instanceof Error) {
        throw type;
      }
      return type;
    }
    try {
      const result = this.doResolveType(normalized);
      this.typeCache.set(cacheKey, result);
      return result;
    } catch (e) {
      this.typeCache.set(cacheKey, e);
      throw e;
    }
  }

  private doResolveType(types: string[]): keyof ResourceMap {
    // Remove `Deleted_` prefix
    const names = many(types).map((t) => t.replace(/^Deleted_/, ''));

    const schema = this.schemaHost.schema;
    const resolved = asNonEmptyArray(
      names
        .flatMap((name) => {
          try {
            return this.resourcesHost.getByDynamicName(name).name;
          } catch (e) {
            // Ignore names/`labels` that don't have corresponding resources.
            return [];
          }
        })
        .filter((name) => schema.getType(name) instanceof GraphQLObjectType),
    );

    if (resolved?.length === 1) {
      return resolved[0];
    }

    const namesStr = names.join(', ');
    if (!resolved) {
      throw new ServerException(
        `Could not determine GraphQL object from type: ${namesStr}`,
      );
    }
    throw new ServerException(
      `Could not decide which GraphQL object type to choose from: ${namesStr}`,
    );
  }
}
