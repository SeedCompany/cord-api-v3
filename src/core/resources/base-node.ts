import { type DateTime } from 'luxon';
import { type ID, isIdLike } from '~/common';

/**
 * The polymorphic reference shape handed between repositories and the
 * {@link import('./resource.loader').ResourceLoader}: `labels` name the
 * resource type (see `ResourceResolver.resolveTypeByBaseNode`) and
 * `properties.id` is the row to load.
 *
 * The shape is inherited from the Neo4j driver's node record, which is why it
 * still carries `identity`. The Postgres repositories build these by hand
 * (`resolveResourceBaseNode`, search, file attachments). Retiring the shape in
 * favor of `{ id, __typename }` references is a separate refactor.
 */
export interface BaseNode {
  identity: string;
  labels: readonly string[];
  properties: {
    id: ID;
    createdAt: DateTime;
  };
}

export const isBaseNode = (value: unknown): value is BaseNode =>
  isNodeShaped(value) && isIdLike(value.properties.id);

const isNodeShaped = (
  value: unknown,
): value is {
  identity: unknown;
  labels: unknown;
  properties: { id?: unknown };
} =>
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  'identity' in value &&
  'labels' in value &&
  'properties' in value &&
  value.properties != null &&
  typeof value.properties === 'object';
