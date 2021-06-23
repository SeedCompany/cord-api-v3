import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable, SetMetadata } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { isObjectType } from 'graphql';
import { ValueOf } from 'type-fest';
import { ID, many, Many, ServerException, Session } from '../../common';
import { ResourceMap } from '../../components/authorization/model/resource-map';
import { BaseNode } from '../database/results';
import { ILogger, Logger } from '../logger';

const RESOLVE_BY_ID = 'RESOLVE_BY_ID';
interface Shape {
  type: ReadonlyArray<keyof ResourceMap>;
}

type SomeResource = ValueOf<ResourceMap>;

/**
 * Register this function as the function to use to lookup the given types.
 *
 * WARNING: It's required that the function signature be:
 * ```
 * (id: ID, session: Session) => Promise<Resource>
 * ```
 *
 * {@link ResourceResolver} can be used to invoke this function.
 */
export const HandleIdLookup = (type: Many<SomeResource>) =>
  SetMetadata<string, Shape>(RESOLVE_BY_ID, {
    type: many(type).map((cls) => cls.name as keyof ResourceMap),
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
  constructor(
    private readonly discover: DiscoveryService,
    private readonly schemaHost: GraphQLSchemaHost,
    @Logger('resource-resolver') private readonly logger: ILogger
  ) {}

  /**
   * Lookup a resource from a Neo4j BaseNode.
   */
  async lookupByBaseNode(node: BaseNode, session: Session) {
    return await this.lookup(node.labels, node.properties.id, session);
  }

  /**
   * Lookup a resource by type and ID.
   *
   * It's expected that possibleTypes is or includes a _single_ concrete type.
   */
  async lookup<TResource extends SomeResource>(
    type: TResource,
    id: ID,
    session: Session
  ): Promise<TResource['prototype']>;
  async lookup<TResourceName extends keyof ResourceMap>(
    type: TResourceName,
    id: ID,
    session: Session
  ): Promise<ResourceMap[TResourceName]['prototype']>;
  async lookup(
    possibleTypes: Many<string | SomeResource>,
    id: ID,
    session: Session
  ): Promise<SomeResource>;
  async lookup(
    possibleTypes: Many<string | SomeResource>,
    id: ID,
    session: Session
  ): Promise<SomeResource> {
    const type = this.resolveType(possibleTypes);
    const discovered = await this.discover.providerMethodsWithMetaAtKey<Shape>(
      RESOLVE_BY_ID
    );
    const filtered = discovered.filter((f) => f.meta.type.includes(type));
    if (filtered.length === 0) {
      throw new ServerException(`Could find resolver for type: ${type}`);
    }
    if (filtered.length > 1) {
      this.logger.warning(`Found more than one resolver for ${type}`);
    }
    const method = filtered[0].discoveredMethod;
    const result = await method.handler.call(
      method.parentClass.instance,
      id,
      session
    );
    return {
      __typename: type,
      ...result,
    };
  }

  private resolveType(types: Many<string | SomeResource>): keyof ResourceMap {
    const names = many(types).map((t) => (typeof t === 'string' ? t : t.name));

    const schema = this.schemaHost.schema;
    const resolved = names.filter((name) => isObjectType(schema.getType(name)));

    if (resolved.length === 1) {
      // This is mostly true...
      return resolved[0] as keyof ResourceMap;
    }

    const namesStr = names.join(', ');
    if (resolved.length === 0) {
      throw new ServerException(
        `Could not determine GraphQL object from type: ${namesStr}`
      );
    }
    throw new ServerException(
      `Could not decide which GraphQL object type to choose from: ${namesStr}`
    );
  }
}
