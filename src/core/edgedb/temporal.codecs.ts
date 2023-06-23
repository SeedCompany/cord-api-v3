import { Client, InvalidArgumentError, LocalDate } from 'edgedb';
import { KNOWN_TYPENAMES } from 'edgedb/dist/codecs/consts';
import { DateTimeCodec, LocalDateCodec } from 'edgedb/dist/codecs/datetime';
import { ScalarCodec } from 'edgedb/dist/codecs/ifaces';
import { ReadBuffer, WriteBuffer } from 'edgedb/dist/primitives/buffer';
import { DateTime } from 'luxon';
import { CalendarDate } from '~/common';

type ScalarCodecMap = Map<string, ScalarCodec>;

export const customScalarCodecsMapFromClient = (
  client: Client,
): ScalarCodecMap => (client as any).pool._codecsRegistry.customScalarCodecs;

export class LuxonDateTimeCodec extends DateTimeCodec {
  static registerTo(map: ScalarCodecMap) {
    const uuid = KNOWN_TYPENAMES.get('std::datetime')!;
    map.set(uuid, new LuxonDateTimeCodec(uuid));
  }
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
  static registerTo(map: ScalarCodecMap) {
    const uuid = KNOWN_TYPENAMES.get('cal::local_date')!;
    map.set(uuid, new LuxonCalendarDateCodec(uuid));
  }
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
