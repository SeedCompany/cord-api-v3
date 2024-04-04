import { InvalidArgumentError } from 'edgedb';
import { JSONCodec } from 'edgedb/dist/codecs/json.js';
import { ReadBuffer, WriteBuffer } from 'edgedb/dist/primitives/buffer.js';
import { RichTextDocument } from '~/common/rich-text.scalar';
import { ScalarInfo } from './type.util';

export class RichTextCodec extends JSONCodec {
  static info: ScalarInfo = {
    module: 'default',
    type: 'RichText',
    ts: RichTextDocument.name,
    path: '~/common/rich-text.scalar',
  };
  tsType = RichTextDocument.name;
  importedType = true;

  encode(buf: WriteBuffer, object: unknown) {
    if (!(object instanceof RichTextDocument)) {
      throw new InvalidArgumentError(
        `a RichTextDocument was expected, got "${String(object)}"`,
      );
    }
    super.encode(buf, object);
  }

  decode(buf: ReadBuffer): RichTextDocument {
    const doc = super.decode(buf);
    return RichTextDocument.from(doc);
  }
}
