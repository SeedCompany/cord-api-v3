import { ValidationOptions } from 'class-validator';
import { isLength } from 'validator';
import { ValidateBy } from './validateBy';

export const IsLength = (
  options?: ValidatorJS.IsLengthOptions,
  validationOptions?: ValidationOptions
) =>
  ValidateBy(
    {
      name: 'isLength',
      constraints: [options],
      validator: {
        validate: (value) =>
          typeof value === 'string' &&
          isLength(value, { min: 6, max: undefined }),
        defaultMessage: () => 'Password must have minimum 6 characters',
      },
    },
    validationOptions
  );
