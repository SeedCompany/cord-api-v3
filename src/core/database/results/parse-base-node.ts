import type { Node } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '../../../common';

export interface BaseNode {
  id: ID;
  createdAt: DateTime;
}

export const parseBaseNodeProperties = (node: Node<BaseNode>) => {
  const { id, createdAt } = node.properties;
  return { id, createdAt };
};
