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
  readonly constraint: ReturnType<typeof parseConstraint>;

  static [Symbol.hasInstance](object: unknown) {
    return (
      object instanceof ConstraintError &&
      object.message.includes('already exists with label')
    );
  }

  static enhance(e: Neo4jError) {
    nonEnumerable(e, 'diagnosticRecord', 'retriable');
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

const getUniqueFailureInfo = (e: Neo4jError) => {
  const uniq = parseUniquenessMessage(e);
  const constraint = parseConstraint(e);
  if (!uniq) {
    throw new Error(
      'Could not determine uniqueness info from error. Are you sure this is a uniqueness constraint failure?',
      { cause: e },
    );
  }

  // Handle what appears to be a regression where the error message is
  // "...already exists with label `Label[30]` and property `PropertyKey[1]` = ..."
  // Not sure what indexes those correspond to - maybe a global label list & the property index on constraint?
  // Work around this by using our naming convention for unique constraints.
  // https://github.com/SeedCompany/cord-api-v3/blob/f363f89c278d099cf76a1f7d3f08edd9578bf2be/src/core/database/common.repository.ts#L180
  if (constraint) {
    const constraintNameParts = constraint.name.split('_');
    uniq.label = uniq.label.startsWith('Label[')
      ? constraintNameParts[0]
      : uniq.label;
    uniq.property = uniq.property.startsWith('PropertyKey[')
      ? constraintNameParts[1]
      : uniq.property;
  }

  return { ...uniq, constraint };
};

const parseUniquenessMessage = (e: Neo4jError) => {
  const exp =
    /Node\((?<node>\d+)\) already exists with label `(?<label>.+)` and property `(?<prop>.+)` = '(?<value>.+)'/;
  const matches = exp.exec(e.message)?.groups;
  if (!matches) {
    return null;
  }
  return {
    node: Number(matches.node),
    label: matches.label,
    property: matches.prop,
    value: matches.value,
  };
};

const parseConstraint = (e: Neo4jError) => {
  const exp =
    /Constraint\(\s*id=(?<id>\d+), name='(?<name>\w+)', type='(?<type>\w+)', schema=(?<schema>\(.+\)), ownedIndex=(?<ownedIndex>\d+)\s*\)/;
  const matches = exp.exec(e.message)?.groups;
  if (!matches) {
    return null;
  }
  return {
    id: Number(matches.id),
    name: matches.name,
    type: matches.type,
    schema: matches.schema,
    ownedIndex: Number(matches.ownedIndex),
  };
};
