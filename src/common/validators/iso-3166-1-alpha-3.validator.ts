import { ValidationOptions } from 'class-validator';
import { whereAlpha3 } from 'iso-3166-1';
import { ValidateBy } from './validateBy';

export const ISO31661Alpha3 = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'ISO-3166-1-Alpha-3',
      validator: {
        validate: (input) =>
          input != null ? Boolean(whereAlpha3(input)) : true,
        defaultMessage: () => 'Invalid ISO-3166-1 alpha-3 country code',
      },
    },
    validationOptions,
  );
