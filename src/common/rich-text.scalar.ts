import { applyDecorators } from '@nestjs/common';
import { ObjectType } from '@nestjs/graphql';
import { type Nil, setToStringTag } from '@seedcompany/common';
import { markSkipClassTransformation } from '@seedcompany/nest';
import { IsObject } from 'class-validator';
import { createHash } from 'crypto';
import { GraphQLScalarType } from 'graphql';
import { GraphQLJSONObject } from 'graphql-scalars';
import { isEqual } from 'lodash';
import type { JsonObject } from 'type-fest';
import { SecuredProperty } from '~/common/secured-property';
import { InputException } from './exceptions/input.exception';
import { OptionalField, type OptionalFieldOptions } from './optional-field';

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
  private readonly blocks?: unknown[];

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
      JSON.parse(value.slice(RichTextDocument.serializedPrefix.length)),
    );
  }

  static serialize(doc: RichTextDocument) {
    return RichTextDocument.serializedPrefix + JSON.stringify(doc);
  }

  static isEqual(
    a: RichTextDocument | null | undefined,
    b: RichTextDocument | null | undefined,
  ) {
    // This is crude but it's better than nothing.
    const aBlocks = a?.blocks ?? [];
    const bBlocks = b?.blocks ?? [];
    return isEqual(aBlocks, bBlocks);
  }
}
setToStringTag(RichTextDocument, 'RichText');
markSkipClassTransformation(RichTextDocument);

export const RichTextField = (options?: OptionalFieldOptions) =>
  applyDecorators(
    OptionalField(() => RichTextScalar, {
      optional: false,
      ...options,
      transform: (prev) => (value) => {
        const doc: RichTextDocument | Nil = prev(
          RichTextDocument.fromMaybe(value),
        );
        if (doc == null && !options?.nullable && !options?.optional) {
          // Should never _really_ get here.
          // UI should understand & send null instead of an empty document.
          // Would prefer this to be done with validators.
          // But I believe this needs `null`s to be validated.
          // skipMissingProperties -> skipUndefinedProperties
          throw new InputException('RichText must be given');
        }
        return doc;
      },
    }),
    IsObject(),
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
export abstract class SecuredRichText extends SecuredProperty<
  typeof RichTextScalar,
  RichTextDocument
>(RichTextScalar) {}

@ObjectType({
  description: SecuredProperty.descriptionFor('a rich text document or null'),
})
export abstract class SecuredRichTextNullable extends SecuredProperty<
  typeof RichTextScalar,
  RichTextDocument,
  true
>(RichTextScalar, {
  nullable: true,
}) {}
