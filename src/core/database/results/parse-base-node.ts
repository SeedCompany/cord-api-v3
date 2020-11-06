import type { Node } from 'cypher-query-builder';
import { DateTime } from 'luxon';

export interface BaseNode {
  id: string;
  createdAt: DateTime;
}

export const parseBaseNodeProperties = (node: Node<BaseNode>) => {
  const { id, createdAt } = node.properties;
  return { id, createdAt };
};
