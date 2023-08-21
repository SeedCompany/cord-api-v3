import type { DateTime } from 'luxon';
import type { Many, RichTextDocument } from '~/common';

export type NativeDbProps<Dto extends Record<string, any>> = {
  [Key in keyof Dto]: Dto[Key] extends NativeDbValue ? Dto[Key] : unknown;
};

export type NativeDbValue = Many<
  boolean | string | number | DateTime | RichTextDocument | null
>;
