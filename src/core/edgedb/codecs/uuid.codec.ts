import { UUIDCodec } from 'edgedb/dist/codecs/uuid.js';
import { ScalarInfo } from './type.util';

export class OurUUIDCodec extends UUIDCodec {
  static info: ScalarInfo = {
    module: 'std',
    type: 'uuid',
    ts: 'ID',
    path: '~/common',
  };
  tsType = 'ID';
  importedType = true;
}
