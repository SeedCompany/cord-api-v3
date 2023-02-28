import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraintInterface,
} from 'class-validator';
import { AnyFn } from '../types';

export interface ValidateByOptions {
  name: string;
  constraints?: any[];
  validator: ValidatorConstraintInterface | AnyFn;
  async?: boolean;
}

export const ValidateBy =
  (
    options: ValidateByOptions,
    validationOptions?: ValidationOptions,
  ): PropertyDecorator =>
  (object: Record<string, any>, propertyName: string | symbol) => {
    registerDecorator({
      name: options.name,
      target: object.constructor,
      propertyName: propertyName as string,
      options: validationOptions,
      constraints: options.constraints,
      validator: options.validator,
      async: options.async,
    });
  };

/**
 * A simpler one.
 * For when you just want validation options to be passed straight through.
 */
export const createValidationDecorator =
  (options: ValidateByOptions) => (validationOptions?: ValidationOptions) =>
    ValidateBy(options, validationOptions);
