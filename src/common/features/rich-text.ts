import { setToStringTag } from '@seedcompany/common';
import { markSkipClassTransformation } from '@seedcompany/nest';
import { isEqual } from 'lodash';
import { createHash } from 'node:crypto';
import type { JsonObject } from 'type-fest';

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
