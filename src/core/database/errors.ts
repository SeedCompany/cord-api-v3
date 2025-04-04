import { nonEnumerable } from '@seedcompany/common';
import { Neo4jError } from 'neo4j-driver';
import { LogEntry, LogLevel } from '../logger';

const defaultCode = 'N/A' as const;

declare module 'neo4j-driver' {
  interface Neo4jError {
    logProps?: LogEntry;
  }
}
const logProps = (e: Neo4jError, entry: LogEntry) =>
  Object.defineProperty(e, 'logProps', {
    value: entry,
    enumerable: false,
  });

export class SyntaxError extends Neo4jError {
  static readonly code = 'Neo.ClientError.Statement.SyntaxError' as const;
  static [Symbol.hasInstance](object: unknown) {
    return isNeo4jError(object) && object.code === SyntaxError.code;
  }
  static enhance(e: Neo4jError) {
    return logProps(e, {
      level: LogLevel.ERROR,
      message: e.message,
      exception: e,
    });
  }
}

export class ServiceUnavailableError extends Neo4jError {
  static readonly code = 'ServiceUnavailable' as const;
  static [Symbol.hasInstance](object: unknown) {
    return isNeo4jError(object) && object.code === ServiceUnavailableError.code;
  }

  static enhance(e: Neo4jError) {
    const stripInfo = (str: string) =>
      str
        // Strip useless empty routing table.
        .replace(
          / No routing servers available. Known routing table:.+$/,
          ' No routing servers available.',
        )
        // Strip excessive documentation.
        .replace(
          ' Please ensure that your database is listening on the correct host and port and that you have compatible encryption settings both on Neo4j server and driver. Note that the default encryption setting has changed in Neo4j 4.0.',
          '',
        );
    e.message = stripInfo(e.message);
    e.stack = stripInfo(e.stack!);
  }
}

export class SessionExpiredError extends Neo4jError {
  static readonly code = 'SessionExpired' as const;
  static [Symbol.hasInstance](object: unknown) {
    return isNeo4jError(object) && object.code === SessionExpiredError.code;
  }
}

export class ConnectionTimeoutError extends Neo4jError {
  static readonly code = defaultCode;
  static [Symbol.hasInstance](object: unknown) {
    return (
      isNeo4jError(object) &&
      object.message.startsWith('Connection acquisition timed out in ')
    );
  }
}

export class ConstraintError extends Neo4jError {
  static readonly code =
    'Neo.ClientError.Schema.ConstraintValidationFailed' as const;
  static [Symbol.hasInstance](object: unknown) {
    return isNeo4jError(object) && object.code === ConstraintError.code;
  }
}

export class UniquenessError extends ConstraintError {
  readonly node: number;
  readonly label: string;
  readonly property: string;
  readonly value: string;

  static [Symbol.hasInstance](object: unknown) {
    return (
      object instanceof ConstraintError &&
      object.message.includes('already exists with label')
    );
  }

  static enhance(e: Neo4jError) {
    const info = getUniqueFailureInfo(e);
    return logProps(Object.assign(e, info), {
      level: LogLevel.WARNING,
      message: 'Duplicate property',
      label: info.label,
      property: info.property,
      value: info.value,
    });
  }
}

export const isNeo4jError = (e: unknown): e is Neo4jError =>
  e instanceof Error && e.name === 'Neo4jError';

export const createBetterError = (e: Error) => {
  if (!isNeo4jError(e)) {
    return e;
  }
  e.message ??= ''; // I've seen the message be null

  const better = cast(e);

  return better;
};

const cast = (e: Neo4jError): Neo4jError => {
  if (e instanceof ServiceUnavailableError) {
    ServiceUnavailableError.enhance(e);
  }
  if (e instanceof UniquenessError) {
    UniquenessError.enhance(e);
  }
  if (e instanceof SyntaxError) {
    SyntaxError.enhance(e);
  }

  nonEnumerable(
    e,
    'constructor',
    '__proto__',
    'name',
    'gqlStatus',
    'gqlStatusDescription',
    'rawClassification',
  );
  !e.cause && nonEnumerable(e, 'cause');
  e.code === defaultCode && nonEnumerable(e, 'code');
  e.classification === 'UNKNOWN' && nonEnumerable(e, 'classification');

  return e;
};

const uniqueMsgRegex =
  /^Node\((\d+)\) already exists with label `(\w+)` and property `(.+)` = '(.+)'$/;
const getUniqueFailureInfo = (e: Neo4jError) => {
  const matches = uniqueMsgRegex.exec(e.message);
  if (!matches) {
    throw new Error(
      'Could not determine uniqueness info from error. Are you sure this is a uniqueness constraint failure?',
    );
  }
  return {
    node: Number(matches[1]),
    label: matches[2],
    property: matches[3],
    value: matches[4],
  };
};
