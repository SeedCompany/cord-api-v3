import { GraphQLSchemaBuilder } from '@nestjs/graphql/dist/graphql-schema.builder.js';
import { SchemaGenerationError } from '@nestjs/graphql/dist/schema-builder/errors/schema-generation.error.js';
import { patchMethod, setInspect } from '@seedcompany/common';
import chalk, { Chalk, type ChalkInstance } from 'chalk';

export const prettifySchemaGenerationError = (e: Error) => {
  if (!(e instanceof SchemaGenerationError)) {
    return e;
  }

  const makeMsg = (chalk: ChalkInstance) =>
    [
      ...(chalk.level > 0 ? [''] : []),
      chalk.whiteBright.bgRedBright('Failed to generate GraphQL schema:'),
      ...(chalk.level > 0 ? [''] : []),
      ...e.details.map(
        (detail) =>
          chalk.dim(' - ') +
          prettyValidationMessage(detail.message, chalk).replace(/\.$/, ''),
      ),
    ].join('\n') + '\n';

  const plain = makeMsg(new Chalk({ level: 0 }));
  const formatted = new Error(plain);
  formatted.stack = plain;
  setInspect(formatted, () => makeMsg(chalk));

  return formatted;
};

interface Formatters {
  typeReference: (type: string, ctx: Formatters) => string;
  fieldReference: (type: string, field: string, ctx: Formatters) => string;
  argumentReference: (
    type: string,
    field: string,
    arg: string,
    ctx: Formatters,
  ) => string;
}
const defaultFormatters = (chalk: ChalkInstance): Formatters => ({
  typeReference: (type) =>
    chalk.cyan(type.replaceAll(/[![\]]/g, (match) => chalk.dim(match))),
  fieldReference: (type, field, ctx) =>
    ctx.typeReference(type, ctx) + chalk.magenta(chalk.dim('.') + field),
  argumentReference: (type, field, arg, ctx) =>
    ctx.fieldReference(type, field, ctx) +
    chalk.cyan(chalk.dim('(') + arg + chalk.dim(':)')),
});

/**
 * Regex match messages from graphql/type/validate.js to identity dynamic
 * strings and add color to help with readability.
 */
export const prettyValidationMessage = (
  message: string,
  formatter?: Formatters | ChalkInstance,
) => {
  const format =
    formatter && 'typeReference' in formatter
      ? formatter
      : defaultFormatters(formatter ?? chalk);
  return message
    .replaceAll(
      /(field|type of|but(?! got:)|argument) (\w+)\.(\w+)(?:\((\w+):\))?/g,
      (_, prefix: string, type: string, field: string, arg?: string) => {
        if (arg) {
          return `${prefix} ${format.argumentReference(type, field, arg, format)}`;
        }
        return `${prefix} ${format.fieldReference(type, field, format)}`;
      },
    )
    .replaceAll(
      /(type(?! (?:of|but got))|implement|implemented by|(?<! includes required )argument) ([\w![\]]+)/gi,
      (_, prefix: string, type: string) =>
        `${prefix} ${format.typeReference(type, format)}`,
    )
    .replaceAll(
      /expected but (\w+) does not provide it/g,
      (match, type: string) =>
        match.replace(type, format.typeReference(type, format)),
    );
};

// Patch GraphQLSchemaBuilder to avoid logging SchemaGenerationErrors.
// We'll log them ourselves in a nicer format.
{
  const caughtTags = new WeakSet();
  patchMethod(GraphQLSchemaBuilder.prototype, 'build', (base) => {
    return async (...args) => {
      const result = await base(...args);
      // Re-throw the error now that we've avoided the catch block in build().
      if (caughtTags.has(result)) {
        throw result;
      }
      return result;
    };
  });
  patchMethod(GraphQLSchemaBuilder.prototype, 'generateSchema', (base) => {
    return async (...args) =>
      await base(...args).catch((e) => {
        caughtTags.add(e); // tag error so we know to throw it up the callstack.
        // return error instead to avoid the log statement the catch block of build()
        // This only works because build() doesn't inspect the result of generateSchema()
        return e;
      });
  });
}
