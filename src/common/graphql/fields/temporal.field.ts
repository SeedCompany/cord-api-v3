import { applyDecorators } from '@nestjs/common';
import { Transform } from 'class-transformer';
import { DateTime } from 'luxon';
import { CalendarDate } from '~/common/temporal';
import { ValidateBy } from '~/common/validators';
import { OptionalField, type OptionalFieldOptions } from './optional.field';

const IsIsoDate = () =>
  ValidateBy({
    name: 'isIso8601',
    validator: {
      validate: (value) => DateTime.isDateTime(value),
      defaultMessage: () => 'Invalid ISO-8601 date string',
    },
  });

export const DateTimeField = (options?: OptionalFieldOptions) =>
  applyDecorators(
    OptionalField(() => DateTime, {
      optional: false,
      ...options,
    }),
    Transform(
      ({ value }) => {
        try {
          return value == null ? null : DateTime.fromISO(value);
        } catch (e) {
          // Let validator below handle the error
          return value;
        }
      },
      {
        toClassOnly: true,
      },
    ),
    IsIsoDate(),
  );

export const DateField = (options?: OptionalFieldOptions) =>
  applyDecorators(
    OptionalField(() => CalendarDate, {
      optional: false,
      ...options,
    }),
    Transform(
      ({ value }) => {
        try {
          return value == null ? null : CalendarDate.fromISO(value);
        } catch (e) {
          // Let validator below handle the error
          return value;
        }
      },
      {
        toClassOnly: true,
      },
    ),
    IsIsoDate(),
  );
