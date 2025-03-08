import { StrCodec } from 'gel/dist/codecs/text.js';
import { ScalarInfo } from './type.util';

export class NanoIDCodec extends StrCodec {
  static info: ScalarInfo = {
    module: 'default',
    type: 'nanoid',
    ts: 'ID',
    path: '~/common/id-field',
  };
  tsType = NanoIDCodec.info.ts;
  tsModule = NanoIDCodec.info.path;
}
