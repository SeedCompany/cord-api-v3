import { applyDecorators, BadRequestException } from '@nestjs/common';
import { CustomScalar, Field, FieldOptions, Scalar } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { stripIndent } from 'common-tags';
import { Kind, ValueNode } from 'graphql';
import { DateTime, Settings } from 'luxon';
import { CalendarDate } from './calendar-date';
import './luxon.neo4j'; // ensure our luxon methods are added

Settings.throwOnInvalid = true;

export const DateTimeField = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => DateTime, options),
    Transform((value) => DateTime.fromISO(value), {
      toClassOnly: true,
    }) as PropertyDecorator
  );

export const DateField = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => CalendarDate, options),
    Transform((value) => CalendarDate.fromISO(value), {
      toClassOnly: true,
    }) as PropertyDecorator
  );

@Scalar('DateTime', () => DateTime)
export class DateTimeScalar
  implements CustomScalar<string, DateTime | string | null> {
  description = 'An ISO-8601 date time string';

  parseValue(value: string): string {
    return value;
  }

  serialize(value: DateTime | string | null): string {
    if (value instanceof DateTime) {
      return value.toISO();
    }
    if (!value) {
      throw new BadRequestException('No DateTime to serialize');
    }
    return value;
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
