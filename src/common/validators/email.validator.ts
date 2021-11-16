import { isEmail, ValidationOptions } from 'class-validator';
import ValidatorJS from 'validator';
import { ValidateBy } from './validateBy';

export const IsEmail = (
  options?: ValidatorJS.IsEmailOptions,
  validationOptions?: ValidationOptions
) =>
  ValidateBy(
    {
      name: 'isEmail',
      constraints: [options],
      validator: {
        validate: (value, args) =>
          value == null ||
          (typeof value === 'string' && isEmail(value, args?.constraints[0])),
        defaultMessage: () =>
          validationOptions?.each
            ? 'Each value in $property must be a valid email'
            : 'Invalid email',
      },
    },
    validationOptions
  );
