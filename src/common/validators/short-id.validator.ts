import { ValidationOptions } from 'class-validator';
import { isValid } from 'shortid';
import { ValidateBy } from './validateBy';

export const IsShortId = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'IsShortId',
      validator: {
        validate: isValid,
        defaultMessage: () =>
          validationOptions?.each
            ? 'Each value in $property must be a valid ID'
            : 'Invalid ID',
      },
    },
    validationOptions
  );
