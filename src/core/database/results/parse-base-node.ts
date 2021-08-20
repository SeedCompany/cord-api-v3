import type { Node } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { ID } from '../../../common';

export type BaseNode = Node<{
  id: ID;
  createdAt: DateTime;
}>;
