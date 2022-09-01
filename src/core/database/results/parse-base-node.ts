import type { Node } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID, isIdLike } from '~/common';

export type BaseNode = Node<{
  id: ID;
  createdAt: DateTime;
}>;

export const isBaseNode = (value: unknown): value is BaseNode =>
  isNode(value) && isIdLike(value.properties.id);

export const isNode = (value: unknown): value is Node =>
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  'identity' in value &&
  'labels' in value &&
  'properties' in value;
