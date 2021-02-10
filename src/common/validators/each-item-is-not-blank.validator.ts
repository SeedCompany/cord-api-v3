import { ValidationOptions } from 'class-validator';
import { ValidateBy } from './validateBy';

export const EachItemIsNotBlank = (
  options?: string[],
  validationOptions?: ValidationOptions
) =>
  ValidateBy(
    {
      name: 'eachItemIsNotBlank',
      constraints: [options],
      validator: {
        validate: (value: any) => {
          let containsValue = false;
          value.forEach(function (item: string) {
            if (item.trim().length > 0) containsValue = true;
          });
          return containsValue;
        },
        defaultMessage: () =>
          validationOptions?.each
            ? 'Each value is not allowed to be blank'
            : 'blank value',
      },
    },
    validationOptions
  );
