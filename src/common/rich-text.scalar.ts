import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions, ObjectType } from '@nestjs/graphql';
import { IsObject } from 'class-validator';
import { createHash } from 'crypto';
import { GraphQLScalarType } from 'graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { JsonObject } from 'type-fest';
import { SecuredProperty } from '~/common/secured-property';
import { Transform } from './transform.decorator';

function hashId(name: string) {
  return createHash('shake256', { outputLength: 5 }).update(name).digest('hex');
}

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

  static fromMaybe(doc: JsonObject | null): RichTextDocument | null {
    if (!doc || !Array.isArray(doc.blocks!) || doc.blocks.length === 0) {
      return null;
    }
    return RichTextDocument.from(doc);
  }

  static fromText(text: string): RichTextDocument {
    return RichTextDocument.from({
      version: '2.25.0',
      time: Date.now(),
      blocks: [{ id: hashId(text), type: 'paragraph', data: { text } }],
    });
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
    Transform(({ value }) => RichTextDocument.fromMaybe(value))
  );

/** @internal */
export const RichTextScalar = new GraphQLScalarType({
  ...GraphQLJSONObject.toConfig(),
  name: 'RichText',
  description: 'A JSON object containing data from a block styled editor',
});

@ObjectType({
  description: SecuredProperty.descriptionFor('a rich text document'),
})
export abstract class SecuredRichText extends SecuredProperty<RichTextDocument>(
  RichTextScalar
) {}
