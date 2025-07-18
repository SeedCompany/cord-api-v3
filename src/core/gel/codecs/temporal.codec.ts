import { InvalidArgumentError, LocalDate } from 'gel';
import type { CodecContext } from 'gel/dist/codecs/context.js';
import { DateTimeCodec, LocalDateCodec } from 'gel/dist/codecs/datetime.js';
import type { ReadBuffer, WriteBuffer } from 'gel/dist/primitives/buffer.js';
import { DateTime } from 'luxon';
import { CalendarDate } from '~/common/temporal';
import type { ScalarInfo } from './type.util';

export class LuxonDateTimeCodec extends DateTimeCodec {
  static info: ScalarInfo = {
    module: 'std',
    type: 'datetime',
    ts: 'DateTime',
    path: 'luxon',
  };
  tsType = LuxonDateTimeCodec.info.ts;
  tsModule = LuxonDateTimeCodec.info.path;

  encode(buf: WriteBuffer, object: unknown, ctx: CodecContext) {
    if (object instanceof Date) {
      super.encode(buf, object, ctx);
      return;
    }
    if (!(object instanceof DateTime)) {
      throw new InvalidArgumentError(
        `a DateTime instance was expected, got "${String(object)}"`,
      );
    }
    super.encode(buf, object.toJSDate(), ctx);
  }

  decode(buf: ReadBuffer, ctx: CodecContext) {
    const date: Date = super.decode(buf, ctx);
    return DateTime.fromJSDate(date) as any;
  }
}

export class LuxonCalendarDateCodec extends LocalDateCodec {
  static info: ScalarInfo = {
    module: 'std::cal',
    type: 'local_date',
    ts: 'CalendarDate',
    path: '~/common/temporal/calendar-date',
  };
  tsType = LuxonCalendarDateCodec.info.ts;
  tsModule = LuxonCalendarDateCodec.info.path;

  encode(buf: WriteBuffer, object: unknown, ctx: CodecContext) {
    if (object instanceof LocalDate) {
      super.encode(buf, object, ctx);
      return;
    }
    if (!(object instanceof CalendarDate)) {
      throw new InvalidArgumentError(
        `a CalendarDate instance was expected, got "${String(object)}"`,
      );
    }
    super.encode(
      buf,
      new LocalDate(object.year, object.month, object.day),
      ctx,
    );
  }

  decode(buf: ReadBuffer, ctx: CodecContext): CalendarDate {
    const date: LocalDate = super.decode(buf, ctx);
    return CalendarDate.fromObject({
      year: date.year,
      month: date.month,
      day: date.day,
    });
  }
}
