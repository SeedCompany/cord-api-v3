import { Query } from 'cypher-query-builder';
import { Session } from '../../common';

export const matchRequestingUser =
  ({ userId }: Pick<Session, 'userId'>) =>
  (query: Query) =>
    query.raw('MATCH (requestingUser:User { id: $requestingUser })', {
      requestingUser: userId,
    });
