import { applyDecorators } from '@nestjs/common';
import { CustomScalar, Field, FieldOptions, Scalar } from '@nestjs/graphql';
import { Kind, ValueNode } from 'graphql';
import { DateTime } from 'luxon';
import { InputException, ServerException } from './exceptions';
import { CalendarDate } from './temporal';
import { Transform } from './transform.decorator';
import { isNumeric } from './util';
import { ValidateBy } from './validators/validateBy';

export type Cursor = string | number | DateTime | CalendarDate | null;

export const CursorField = (options?: FieldOptions) => {
  return applyDecorators(
    Field(() => CursorScalar, options),
    Transform(
      (value) => {
        try {
          return decodeCursor(value);
        } catch (e) {
          return e; // return error so validator throws appropriate exception
        }
      },
      {
        toClassOnly: true,
      }
    ),
    ValidateBy({
      name: 'isCursor',
      validator: {
        validate: (value) => !(value instanceof Error),
        defaultMessage: (args) =>
          args?.value instanceof Error ? args.value.message : 'Invalid cursor',
      },
    })
  );
};

@Scalar('Cursor')
export class CursorScalar
  implements CustomScalar<string, string | number | DateTime>
{
  description = 'An opaque cursor to use with pagination';

  parseValue(value: string) {
    return value; // let validator parse to throw error
  }

  serialize(value: DateTime | string | number): string {
    return encodeCursor(value);
  }

  parseLiteral(ast: ValueNode) {
    if (ast.kind === Kind.INT || ast.kind === Kind.FLOAT) {
      return `num=${ast.value}`;
    }
    if (ast.kind === Kind.STRING) {
      return this.parseValue(ast.value);
    }
    return null;
  }
}

const encodeCursor = (value: Cursor): string => {
  if (value instanceof CalendarDate) {
    return `d=${value.toISO()}`;
  }
  if (value instanceof DateTime) {
    return `dt=${value.toISO()}`;
  }
  if (typeof value === 'number') {
    return `num=${value}`;
  }
  if (typeof value === 'string') {
    return `str=${value}`;
  }
  if (value == null) {
    return '';
  }
  throw new ServerException(
    'Unable to determine how to serialize cursor value'
  );
};

const decodeCursor = (cursor: string): Cursor => {
  if (cursor === '') {
    return null;
  }
  const [type, value] = cursor.includes('=')
    ? cursor.split('=', 2)
    : [null, cursor];
  const decoders: Record<string, (value: string) => any> = {
    dt: (val) => DateTime.fromISO(val),
    d: (val) => CalendarDate.fromISO(val),
    num: (val) => Number(val),
    str: (val) => val,
  };
  if (type && decoders[type]) {
    return decoders[type](value);
  }

  if (type) {
    // if type was given, but we don't know what it is just throw
    throw new InputException(`Cursor type of "${type}" is unknown`);
  }

  // guess number
  if (isNumeric(value)) {
    return parseFloat(value);
  }

  // guess date / date time
  // I don't think it matters for neo4j temporal comparison?
  try {
    return DateTime.fromISO(value);
  } catch {
    // fallthrough
  }

  // not going to assume it's a random string
  throw new InputException('Invalid cursor');
};
