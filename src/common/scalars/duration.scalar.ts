import { type CustomScalar, Scalar } from '@nestjs/graphql';
import { mapEntries, type Nil } from '@seedcompany/common';
import type { DurationIn } from '@seedcompany/common/temporal/luxon';
import { stripIndent } from 'common-tags';
import { GraphQLError, Kind, type ValueNode } from 'graphql';
import { GraphQLDuration } from 'graphql-scalars';
import { Duration } from 'luxon';

@Scalar('Duration', () => Duration)
export class DurationScalar implements CustomScalar<string, DurationIn | null> {
  description = (
    stripIndent(GraphQLDuration.description!) +
    '\n' +
    stripIndent`
      For inputs, ISO strings are accepted, but also many other forms:
      An integer/float can be used to specify in milliseconds.
      An object declaring numeric values for each unit: \`{ days: 2 }\`
      Or a human-readable string: \`"1 day 5 hours 3 mins 2s"\`
    `
  ).replaceAll(/\n(?!\n)/g, '\n\n');

  parseLiteral(ast: ValueNode, variables: Record<string, unknown> | Nil) {
    if (ast.kind === Kind.NULL) {
      return null; // idk if this is necessary
    }
    if (
      ast.kind === Kind.STRING ||
      ast.kind === Kind.FLOAT ||
      ast.kind === Kind.INT
    ) {
      return Duration.from(ast.value);
    }
    if (ast.kind === Kind.OBJECT) {
      return Duration.fromObject(
        Object.fromEntries(
          mapEntries(ast.fields, ({ name: { value: name }, value }) => {
            if (
              value.kind !== Kind.INT &&
              value.kind !== Kind.FLOAT &&
              value.kind !== Kind.VARIABLE
            ) {
              throw new GraphQLError(
                `Duration object literals can only have numeric values for each unit`,
              );
            }
            const parsed =
              value.kind === Kind.VARIABLE
                ? variables?.[value.name.value]
                : parseFloat(value.value);

            return [name, parsed];
          }),
        ),
      );
    }

    throw new GraphQLError(`Durations cannot be parsed as: ${ast.kind}`);
  }

  parseValue(value: any) {
    return Duration.from(value);
  }

  serialize(value: unknown) {
    if (Duration.isDuration(value)) {
      return value.toISO();
    }
    if (typeof value === 'string') {
      return value;
    }
    throw new GraphQLError(
      'Expected a Duration but received a: ' + typeof value,
    );
  }
}
