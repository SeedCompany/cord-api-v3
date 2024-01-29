import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import {
  ValidationArguments,
  ValidationOptions,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { ValidationException } from '~/core/validation';
import { isValidId } from '../generate-id';
import { ID } from '../id-field';
import { ValidateBy } from './validateBy';

export const IsId = (validationOptions?: ValidationOptions) =>
  ValidateBy(ValidIdConstraint, {
    message: validationOptions?.each
      ? 'Each value in $property must be a valid ID'
      : 'Invalid ID',
    ...validationOptions,
  });

@Injectable()
export class IdResolver {
  async resolve(value: ID): Promise<ID> {
    return value;
  }
}

@Injectable()
@ValidatorConstraint({ name: 'IsId', async: true })
export class ValidIdConstraint implements ValidatorConstraintInterface {
  constructor(private readonly resolver: IdResolver) {}

  async validate(value: unknown, args: ValidationArguments) {
    if (isValidId(value)) {
      (args.object as any)[args.property] = await this.resolver.resolve(value);
      return true;
    }
    return false;
  }
}

@Injectable()
export class ValidateIdPipe implements PipeTransform {
  constructor(private readonly resolver: IdResolver) {}

  transform(id: unknown, metadata: ArgumentMetadata) {
    if (id == null) {
      return null;
    }
    if (isValidId(id)) {
      return this.resolver.resolve(id);
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
