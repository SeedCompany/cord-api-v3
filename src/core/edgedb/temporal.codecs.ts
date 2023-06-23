import { InvalidArgumentError, LocalDate } from 'edgedb';
import { DateTimeCodec, LocalDateCodec } from 'edgedb/dist/codecs/datetime.js';
import { ReadBuffer, WriteBuffer } from 'edgedb/dist/primitives/buffer.js';
import { DateTime } from 'luxon';
import { CalendarDate } from '~/common';

export class LuxonDateTimeCodec extends DateTimeCodec {
  static edgedbTypeName = 'std::datetime';

  encode(buf: WriteBuffer, object: unknown) {
    if (object instanceof Date) {
      super.encode(buf, object);
      return;
    }
    if (!(object instanceof DateTime)) {
      throw new InvalidArgumentError(
        `a DateTime instance was expected, got "${String(object)}"`,
      );
    }
    super.encode(buf, object.toJSDate());
  }

  decode(buf: ReadBuffer): DateTime {
    const date: Date = super.decode(buf);
    return DateTime.fromJSDate(date);
  }
}

export class LuxonCalendarDateCodec extends LocalDateCodec {
  static edgedbTypeName = 'cal::local_date';

  encode(buf: WriteBuffer, object: unknown) {
    if (object instanceof LocalDate) {
      super.encode(buf, object);
      return;
    }
    if (!(object instanceof CalendarDate)) {
      throw new InvalidArgumentError(
        `a CalendarDate instance was expected, got "${String(object)}"`,
      );
    }
    super.encode(buf, new LocalDate(object.year, object.month, object.day));
  }

  decode(buf: ReadBuffer): CalendarDate {
    const date: LocalDate = super.decode(buf);
    return CalendarDate.fromObject({
      year: date.year,
      month: date.month,
      day: date.day,
    });
  }
}
