const Key = Symbol('ValidateEditability');

export const ValidateEditability =
  (validate = true): PropertyDecorator =>
  (target, propertyKey) => {
    Reflect.defineMetadata(Key, validate, target, propertyKey);
  };

export const shouldValidateEditability = (object: any, property: string) =>
  !!Reflect.getMetadata(Key, object, property);
