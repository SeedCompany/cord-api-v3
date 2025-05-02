import type { ICodec, ScalarCodec } from 'gel/dist/codecs/ifaces';
import type { Class } from 'type-fest';

export type ScalarCodecClass = Class<ScalarCodec & ICodec> & {
  info: ScalarInfo;
};

export interface ScalarInfo {
  module: string;
  type: string;
  ts: string;
  path: string;
}
