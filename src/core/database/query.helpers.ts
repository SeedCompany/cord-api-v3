import { Query } from 'cypher-query-builder';
import { Session } from '../../common';
import { requestingUser } from './query';

export const matchRequestingUser =
  ({ userId }: Pick<Session, 'userId'>) =>
  (query: Query) =>
    query.match(requestingUser(userId));
