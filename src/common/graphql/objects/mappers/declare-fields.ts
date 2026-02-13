import type { Type } from '@nestjs/common';
import { Field, type FieldOptions, type ReturnTypeFunc } from '@nestjs/graphql';
import { entries } from '@seedcompany/common';

/**
 * A helper to declare @Field decorators externally
 */
export const declareGqlFields = <T>(
  obj: Type<T>,
  fields: { [_ in keyof T]?: FieldOptions & { type: ReturnTypeFunc } },
) => {
  for (const [name, val] of entries(fields)) {
    if (val) {
      const { type, ...options } = val;
      Field(type, options as FieldOptions)(obj.prototype, name);
    }
  }
};
