import { v1 as Neo } from 'neo4j-driver';
import { LogEntry, LogLevel } from '../logger';

declare module 'neo4j-driver/types/v1' {
  interface Neo4jError {
    logProps?: LogEntry;
  }
}

const defineLogEntry = (obj: unknown, logEntry: LogEntry) => {
  Object.defineProperty(obj, 'logProps', {
    value: logEntry,
    writable: true,
    configurable: true,
    enumerable: false,
  });
};

export class SyntaxError extends Neo.Neo4jError {
  static readonly code = 'Neo.ClientError.Statement.SyntaxError' as const;

  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    defineLogEntry(this, {
      level: LogLevel.ERROR,
      message: this.message,
      exception: this,
    });
  }

  static fromNeo(e: Neo.Neo4jError) {
    if (e instanceof SyntaxError) {
      return e;
    }
    const ex = new this(e.message);
    ex.stack = e.stack;
    return ex;
  }
}

export class ConstraintError extends Neo.Neo4jError {
  static readonly code = 'Neo.ClientError.Schema.ConstraintValidationFailed' as const;
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }

  static fromNeo(e: Neo.Neo4jError) {
    if (e instanceof ConstraintError) {
      return e;
    }
    const ex = new this(e.message);
    ex.stack = e.stack;
    return ex;
  }
}

export class UniquenessError extends ConstraintError {
  constructor(
    readonly node: number,
    readonly label: string,
    readonly property: string,
    readonly value: string,
    message: string
  ) {
    super(message);
    defineLogEntry(this, {
      level: LogLevel.WARNING,
      message: 'Duplicate property',
      label: this.label,
      property: this.property,
      value: this.value,
    });
  }

  static fromNeo(e: Neo.Neo4jError) {
    if (e instanceof UniquenessError) {
      return e;
    }
    const info = getUniqueFailureInfo(e);
    const ex = new this(
      info.node,
      info.label,
      info.property,
      info.value,
      e.message
    );
    ex.stack = e.stack;
    return ex;
  }
}

export const isNeo4jError = (e: unknown): e is Neo.Neo4jError =>
  e instanceof Neo.Neo4jError;

export const createBetterError = (e: Error) => {
  if (!isNeo4jError(e)) {
    return e;
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
  return e;
};

const uniqueMsgRegex = /^Node\((\d+)\) already exists with label `(\w+)` and property `(.+)` = '(.+)'$/;
const getUniqueFailureInfo = (e: Neo.Neo4jError) => {
  const matches = uniqueMsgRegex.exec(e.message);
  if (!matches) {
    throw new Error(
      'Could not determine uniqueness info from error. Are you sure this is a uniqueness constraint failure?'
    );
  }
  return {
    node: Number(matches[1]),
    label: matches[2],
    property: matches[3],
    value: matches[4],
  };
};
