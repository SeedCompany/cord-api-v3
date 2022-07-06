import { ValidationOptions } from 'class-validator';
import { ValidateBy } from './validateBy';

export const IsValidDateRange = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'isValidDateRange',
      validator: {
        validate: (mouStartOverride, args) => {
          const mouEndOverride = (args?.object as any).mouEndOverride;
          return mouEndOverride ? mouStartOverride <= mouEndOverride : true;
        },
        defaultMessage: () => {
          return 'Invalid date range, mou start date should come before mou end date';
        },
      },
    },
    validationOptions
  );
