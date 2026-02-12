import { type CustomScalar, Scalar } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Kind, type ValueNode } from 'graphql';
import { DateTime } from 'luxon';
import { InputException } from '~/common/exceptions';
import { CalendarDate } from '~/common/temporal';

@Scalar('DateTime', () => DateTime)
export class DateTimeScalar implements CustomScalar<
  string,
  DateTime | string | null
> {
  description = 'An ISO-8601 date time string';

  parseValue(value: unknown): string {
    return String(value);
  }

  serialize(value: unknown): string {
    if (DateTime.isDateTime(value)) {
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
