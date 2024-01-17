import { RichTextCodec } from './rich-text.codec';
import { LuxonCalendarDateCodec, LuxonDateTimeCodec } from './temporal.codec';
import { ScalarCodecClass } from './type.util';
import { OurUUIDCodec } from './uuid.codec';

export { registerCustomScalarCodecs } from './register-codecs';
export type { ScalarInfo } from './type.util';

export const codecs: readonly ScalarCodecClass[] = [
  OurUUIDCodec,
  LuxonDateTimeCodec,
  LuxonCalendarDateCodec,
  RichTextCodec,
];
