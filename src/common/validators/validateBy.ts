import { Type } from '@nestjs/common';
import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraintInterface,
} from 'class-validator';
import { MergeExclusive } from 'type-fest';

export type ValidateByOptions =
  | MergeExclusive<
      {
        validator: ValidatorConstraintInterface;
        name: string;
        async?: boolean;
        constraints?: any[];
      },
      {
        validator: Type<ValidatorConstraintInterface>;
        constraints?: any[];
      }
    >
  | Type<ValidatorConstraintInterface>;

export const ValidateBy =
  (
    options: ValidateByOptions,
    validationOptions?: ValidationOptions,
  ): PropertyDecorator =>
  (object: Record<string, any>, propertyName: string | symbol) => {
    registerDecorator({
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      ...options,
      validator: typeof options === 'function' ? options : options.validator,
    });
  };

/**
 * A simpler one.
 * For when you just want validation options to be passed straight through.
 */
export const createValidationDecorator =
  (options: ValidateByOptions) => (validationOptions?: ValidationOptions) =>
    ValidateBy(options, validationOptions);
