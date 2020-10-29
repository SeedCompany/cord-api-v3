import type { Node } from 'cypher-query-builder';
import { DateTime } from 'luxon';

export interface BaseNode {
  id: string;
  createdAt: DateTime;
  sortValue?: string;
}

export const parseBaseNodeProperties = (node: Node<BaseNode>) => {
  const { id, createdAt, sortValue } = node.properties;
  return { id, createdAt, sortValue };
};
