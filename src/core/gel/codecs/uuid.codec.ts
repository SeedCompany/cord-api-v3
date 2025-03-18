import { UUIDCodec } from 'gel/dist/codecs/uuid.js';
import { ScalarInfo } from './type.util';

export class OurUUIDCodec extends UUIDCodec {
  static info: ScalarInfo = {
    module: 'std',
    type: 'uuid',
    ts: 'ID',
    path: '~/common/id-field',
  };
  tsType = OurUUIDCodec.info.ts;
  tsModule = OurUUIDCodec.info.path;
}
