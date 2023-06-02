import { Neo4jError } from 'neo4j-driver';
import { mapFromList } from '../../common';
import { LogEntry, LogLevel } from '../logger';

declare module 'neo4j-driver' {
  interface Neo4jError {
    logProps?: LogEntry;
  }
}

export class SyntaxError extends Neo4jError {
  static readonly code = 'Neo.ClientError.Statement.SyntaxError' as const;

  constructor(message: string) {
    super(message, SyntaxError.code);
    this.constructor = SyntaxError;
    this.__proto__ = SyntaxError.prototype;
    this.name = this.constructor.name;
    this.logProps = {
      level: LogLevel.ERROR,
      message: this.message,
      exception: this,
    };
    noEnumerate(this, 'constructor', '__proto__', 'name', 'code', 'logProps');
  }

  static fromNeo(e: Neo4jError) {
    if (e instanceof SyntaxError) {
      return e;
    }
    const ex = new this(e.message);
    ex.stack = e.stack;
    return ex;
  }
}

export class ServiceUnavailableError extends Neo4jError {
  static readonly code = 'ServiceUnavailable' as const;

  constructor(message: string) {
    super(message, ServiceUnavailableError.code);
    this.constructor = ServiceUnavailableError;
    this.__proto__ = ServiceUnavailableError.prototype;
    this.name = this.constructor.name;
    noEnumerate(this, 'constructor', '__proto__', 'name', 'code');
  }

  static fromNeo(e: Neo4jError) {
    if (e instanceof ServiceUnavailableError) {
      return e;
    }
    const message = e.message
      // Strip useless empty routing table.
      .replace(
        / No routing servers available. Known routing table:.+$/,
        ' No routing servers available.',
      )
      // Strip excessive documentation.
      .replace(
        'Please ensure that your database is listening on the correct host and port and that you have compatible encryption settings both on Neo4j server and driver. Note that the default encryption setting has changed in Neo4j 4.0. ',
        '',
      );
    const ex = new this(message);
    replaceStack(ex, e);
    return ex;
  }
}

export class SessionExpiredError extends Neo4jError {
  static readonly code = 'SessionExpired' as const;

  constructor(message: string) {
    super(message, SessionExpiredError.code);
    this.constructor = SessionExpiredError;
    this.__proto__ = SessionExpiredError.prototype;
    this.name = this.constructor.name;
    noEnumerate(this, 'constructor', '__proto__', 'name', 'code');
  }

  static fromNeo(e: Neo4jError) {
    if (e instanceof SessionExpiredError) {
      return e;
    }
    const ex = new this(e.message);
    replaceStack(ex, e);
    return ex;
  }
}

export class ConnectionTimeoutError extends Neo4jError {
  static readonly code = 'N/A' as const;

  constructor(message: string) {
    super(message, ConnectionTimeoutError.code);
    this.constructor = ConnectionTimeoutError;
    this.__proto__ = ConnectionTimeoutError.prototype;
    this.name = this.constructor.name;
    noEnumerate(this, 'constructor', '__proto__', 'name', 'code');
  }

  static fromNeo(e: Neo4jError) {
    if (e instanceof ConnectionTimeoutError) {
      return e;
    }
    const ex = new this(e.message);
    replaceStack(ex, e);
    return ex;
  }
}

export class ConstraintError extends Neo4jError {
  static readonly code =
    'Neo.ClientError.Schema.ConstraintValidationFailed' as const;
  constructor(message: string) {
    super(message, ConstraintError.code);
    this.constructor = ConstraintError;
    this.__proto__ = ConstraintError.prototype;
    this.name = this.constructor.name;
    noEnumerate(this, 'constructor', '__proto__', 'name', 'code');
  }

  static fromNeo(e: Neo4jError) {
    if (e instanceof ConstraintError) {
      return e;
    }
    const ex = new this(e.message);
    replaceStack(ex, e);
    return ex;
  }
}

export class UniquenessError extends ConstraintError {
  constructor(
    readonly node: number,
    readonly label: string,
    readonly property: string,
    readonly value: string,
    message: string,
  ) {
    super(message);
    this.constructor = UniquenessError;
    this.__proto__ = UniquenessError.prototype;
    this.name = this.constructor.name;
    this.logProps = {
      level: LogLevel.WARNING,
      message: 'Duplicate property',
      label: this.label,
      property: this.property,
      value: this.value,
    };
    noEnumerate(this, 'constructor', '__proto__', 'name', 'code', 'logProps');
  }

  static fromNeo(e: Neo4jError) {
    if (e instanceof UniquenessError) {
      return e;
    }
    const info = getUniqueFailureInfo(e);
    const ex = new this(
      info.node,
      info.label,
      info.property,
      info.value,
      e.message,
    );
    replaceStack(ex, e);
    return ex;
  }
}

export const isNeo4jError = (e: unknown): e is Neo4jError =>
  e instanceof Error && e.name === 'Neo4jError';

export const createBetterError = (e: Error) => {
  if (!isNeo4jError(e)) {
    return e;
  }
  e.message ??= ''; // I've seen message is null

  const better = cast(e);

  return better;
};

const cast = (e: Neo4jError): Neo4jError => {
  if (e.code === ServiceUnavailableError.code) {
    return ServiceUnavailableError.fromNeo(e);
  }
  if (e.code === SessionExpiredError.code) {
    return SessionExpiredError.fromNeo(e);
  }
  if (e.code === ConstraintError.code) {
    if (e.message.includes('already exists with label')) {
      return UniquenessError.fromNeo(e);
    }
    return ConstraintError.fromNeo(e);
  }
  if (e.code === SyntaxError.code) {
    return SyntaxError.fromNeo(e);
  }
  if (e.message.startsWith('Connection acquisition timed out in ')) {
    return ConnectionTimeoutError.fromNeo(e);
  }

  noEnumerate(e, 'constructor', '__proto__', 'name');
  // Hide worthless code
  if (e.code === 'N/A') {
    noEnumerate(e, 'code');
  }

  return e;
};

const replaceStack = (e: Error, original: Error) => {
  e.stack = `${e.name}: ${e.message}`;

  const originalStack = original.stack;
  const stackStart = originalStack?.indexOf('    at') ?? -1;
  const originalTrace = stackStart >= 0 ? originalStack!.slice(stackStart) : '';
  if (originalTrace) {
    e.stack += `\n${originalTrace}`;
  }

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

const noEnumerate = <T>(
  obj: T,
  ...keys: Array<(keyof T & string) | 'constructor'>
) =>
  Object.defineProperties(
    obj,
    mapFromList(keys, (key) => [key, { enumerable: false }]),
  );
