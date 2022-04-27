export const DbLabelSymbol = Symbol('DbLabelSymbol');

export const DbLabel =
  (...labels: string[]): PropertyDecorator & ClassDecorator =>
  (target: any, key?: string | symbol) => {
    if (!key) {
      const current = Reflect.getMetadata(DbLabelSymbol, target) ?? [];
      Reflect.defineMetadata(DbLabelSymbol, [...current, ...labels], target);
      return target;
    }
    const current = Reflect.getMetadata(DbLabelSymbol, target, key) ?? [];
    Reflect.defineMetadata(DbLabelSymbol, [...current, ...labels], target, key);
  };
