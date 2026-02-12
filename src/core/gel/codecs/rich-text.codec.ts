import { InvalidArgumentError } from 'gel';
import type { CodecContext } from 'gel/dist/codecs/context.js';
import { JSONCodec } from 'gel/dist/codecs/json.js';
import type { ReadBuffer, WriteBuffer } from 'gel/dist/primitives/buffer.js';
import { RichTextDocument } from '~/common/features/rich-text';
import { type ScalarInfo } from './type.util';

export class RichTextCodec extends JSONCodec {
  static info: ScalarInfo = {
    module: 'default',
    type: 'RichText',
    ts: RichTextDocument.name,
    path: '~/common/features/rich-text',
  };
  tsType = RichTextCodec.info.ts;
  tsModule = RichTextCodec.info.path;

  encode(buf: WriteBuffer, object: unknown, ctx: CodecContext) {
    if (!(object instanceof RichTextDocument)) {
      throw new InvalidArgumentError(
        `a RichTextDocument was expected, got "${String(object)}"`,
      );
    }
    super.encode(buf, object, ctx);
  }

  decode(buf: ReadBuffer, ctx: CodecContext): RichTextDocument {
    const doc = super.decode(buf, ctx);
    return RichTextDocument.from(doc);
  }
}
