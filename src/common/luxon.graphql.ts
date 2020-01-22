import { applyDecorators } from '@nestjs/common';
import { CustomScalar, Scalar } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { stripIndent } from 'common-tags';
import { Kind, ValueNode } from 'graphql';
import { DateTime, Settings } from 'luxon';
import { Field } from 'type-graphql';
import { AdvancedOptions } from 'type-graphql/dist/decorators/types';
import './luxon.neo4j'; // ensure our luxon methods are added

Settings.throwOnInvalid = true;

export const DateTimeField = (options?: AdvancedOptions) =>
  applyDecorators(
    Field(() => DateTime, options),
    Transform(value => DateTime.fromISO(value), {
      toClassOnly: true,
    }) as PropertyDecorator,
  );

export const DateField = (options?: AdvancedOptions) =>
  applyDecorators(
    Field(() => Date, options),
    Transform(value => DateTime.fromISO(value).startOf('day'), {
      toClassOnly: true,
    }) as PropertyDecorator,
  );

// A marker to connect DateField decorator to DateScalar
class Date extends DateTime {}

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
      throw new Error('No DateTime to serialize');
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

@Scalar('Date', () => Date)
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
