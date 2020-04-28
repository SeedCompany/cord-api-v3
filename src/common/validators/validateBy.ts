import {
  registerDecorator,
  ValidationOptions,
  ValidatorConstraintInterface,
} from 'class-validator';

export interface ValidateByOptions {
  name: string;
  constraints?: any[];
  validator: ValidatorConstraintInterface | Function;
  async?: boolean;
}

export const ValidateBy = (
  options: ValidateByOptions,
  validationOptions?: ValidationOptions
): PropertyDecorator => (object: object, propertyName: string | symbol) => {
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
