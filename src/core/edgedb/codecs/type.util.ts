import { ICodec, ScalarCodec } from 'edgedb/dist/codecs/ifaces';
import { Class } from 'type-fest';

export type ScalarCodecClass = Class<ScalarCodec & ICodec> & {
  info: ScalarInfo;
};

export interface ScalarInfo {
  module: string;
  type: string;
  ts: string;
  path: string;
}
