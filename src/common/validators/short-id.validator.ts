import { ValidationOptions } from 'class-validator';
import { isValidId } from '../generate-id';
import { ValidateBy } from './validateBy';

export const IsId = (validationOptions?: ValidationOptions) =>
  ValidateBy(
    {
      name: 'IsId',
      validator: {
        validate: isValidId,
        defaultMessage: () =>
          validationOptions?.each
            ? 'Each value in $property must be a valid ID'
            : 'Invalid ID',
      },
    },
    validationOptions
  );
