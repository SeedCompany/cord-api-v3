import type { Node } from 'cypher-query-builder';
import { type DateTime } from 'luxon';
import { type ID, isIdLike } from '~/common';

export interface BaseNode {
  identity: string;
  labels: readonly string[];
  properties: {
    id: ID;
    createdAt: DateTime;
  };
}

export const isBaseNode = (value: unknown): value is BaseNode =>
  isNode(value) && isIdLike(value.properties.id);

export const isNode = (value: unknown): value is Node =>
  value != null &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  'identity' in value &&
  'labels' in value &&
  'properties' in value;
