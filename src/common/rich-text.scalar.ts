import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions } from '@nestjs/graphql';
import { IsObject } from 'class-validator';
import { GraphQLScalarType } from 'graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { JsonObject } from 'type-fest';
import { Transform } from './transform.decorator';

/**
 * A JSON object containing data from a block styled editor.
 * Probably best to treat this as opaque.
 */
export class RichTextDocument {
  static from(doc: JsonObject): RichTextDocument {
    return Object.assign(new RichTextDocument(), doc);
  }
}

export const RichTextField = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => RichTextScalar, options),
    IsObject(),
    Transform(({ value }) => RichTextDocument.from(value))
  );

/** @internal */
export const RichTextScalar = new GraphQLScalarType({
  ...GraphQLJSONObject.toConfig(),
  name: 'RichText',
  description: 'A JSON object containing data from a block styled editor',
});
