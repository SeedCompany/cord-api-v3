import { ArgumentMetadata, PipeTransform } from '@nestjs/common';
import { ValidationOptions } from 'class-validator';
import { ValidationException } from '~/core/validation';
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
    validationOptions,
  );

export class ValidateIdPipe implements PipeTransform {
  transform(id: unknown, metadata: ArgumentMetadata) {
    if (id == null || isValidId(id)) {
      return id;
    }
    throw new ValidationException([
      {
        property: metadata.data!,
        value: id,
        constraints: {
          IsId: 'Invalid ID',
        },
      },
    ]);
  }
}
