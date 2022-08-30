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
  // Allows TS to uniquely identify values
  #isRichText?: never;

  static from(doc: JsonObject): RichTextDocument {
    return Object.assign(new RichTextDocument(), doc);
  }

  /** Used to identify this document stored as a string in the DB */
  private static readonly serializedPrefix = '\0RichText\0';

  static isSerialized(value: any): value is string {
    return (
      typeof value === 'string' &&
      value.startsWith(RichTextDocument.serializedPrefix)
    );
  }

  static fromSerialized(value: string) {
    return RichTextDocument.from(
      JSON.parse(value.slice(RichTextDocument.serializedPrefix.length))
    );
  }

  static serialize(doc: RichTextDocument) {
    return RichTextDocument.serializedPrefix + JSON.stringify(doc);
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
