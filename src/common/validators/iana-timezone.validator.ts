import { ValidationOptions } from 'class-validator';
import { ValidateBy } from './validateBy';

export const IsIanaTimezone = (
  options?: ValidationOptions,
  validationOptions?: ValidationOptions,
) =>
  ValidateBy(
    {
      name: 'IsIanaTimezone',
      constraints: [options],
      validator: {
        validate: (value) => {
          try {
            Intl.DateTimeFormat(undefined, { timeZone: value });
            return true;
          } catch (ex) {
            return false;
          }
        },
        defaultMessage: () => 'Timezone is not valid',
      },
    },
    validationOptions,
  );
