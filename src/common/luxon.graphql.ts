import { applyDecorators } from '@nestjs/common';
import { CustomScalar, Field, FieldOptions, Scalar } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Kind, ValueNode } from 'graphql';
import { DateTime, Settings } from 'luxon';
import { InputException } from './exceptions';
import { CalendarDate } from './temporal';
import { Transform } from './transform.decorator';
import { ValidateBy } from './validators/validateBy';

Settings.throwOnInvalid = true;

const IsIsoDate = () =>
  ValidateBy({
    name: 'isIso8601',
    validator: {
      validate: (value) => DateTime.isDateTime(value),
      defaultMessage: () => 'Invalid ISO-8601 date string',
    },
  });

export const DateTimeField = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => DateTime, options),
    Transform(
      ({ value }) => {
        try {
          return value == null ? null : DateTime.fromISO(value);
        } catch (e) {
          // Let validator below handle the error
          return value;
        }
      },
      {
        toClassOnly: true,
      },
    ),
    IsIsoDate(),
  );

export const DateField = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => CalendarDate, options),
    Transform(
      ({ value }) => {
        try {
          return value == null ? null : CalendarDate.fromISO(value);
        } catch (e) {
          // Let validator below handle the error
          return value;
        }
      },
      {
        toClassOnly: true,
      },
    ),
    IsIsoDate(),
  );

@Scalar('DateTime', () => DateTime)
export class DateTimeScalar
  implements CustomScalar<string, DateTime | string | null>
{
  description = 'An ISO-8601 date time string';

  parseValue(value: unknown): string {
    return String(value);
  }

  serialize(value: unknown): string {
    if (value instanceof DateTime) {
      return value.toISO();
    }
    if (typeof value === 'string') {
      return value;
    }
    throw new InputException('Could not serialize DateTime value');
  }

  parseLiteral(ast: ValueNode): string | null {
    if (ast.kind === Kind.STRING) {
      return this.parseValue(ast.value);
    }
    return null;
  }
}

@Scalar('Date', () => CalendarDate)
export class DateScalar extends DateTimeScalar {
  description = stripIndent`
    An ISO-8601 date string.
    Time should be ignored for this field.
  `;

  serialize(value: DateTime | string | null): string {
    if (value instanceof DateTime) {
      return value.toISODate();
    }
    return super.serialize(value);
  }
}
