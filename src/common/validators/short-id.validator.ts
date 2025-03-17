import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { cached } from '@seedcompany/common';
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

  private readonly resolved = new WeakMap<
    object,
    Map<string, Promise<boolean>>
  >();

  async validate(_value: unknown, args: ValidationArguments) {
    const value = args.value as unknown;
    const object = args.object as Record<string, unknown>;
    const { property } = args;

    if (!Array.isArray(value)) {
      if (!isValidId(value)) {
        return false;
      }
      object[property] = await this.resolver.resolve(value);
      return true;
    }

    // validate() is called with every item in the array when using the `each` option.
    // We want to only do this work once for the entire list, though.
    const alreadyResolved = cached(
      this.resolved,
      object,
      () => new Map<string, Promise<boolean>>(),
    );
    return await cached(alreadyResolved, property, async () => {
      if (!value.every(isValidId)) {
        return false;
      }
      object[property] = await Promise.all(
        value.map((id) => this.resolver.resolve(id)),
      );
      return true;
    });
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
