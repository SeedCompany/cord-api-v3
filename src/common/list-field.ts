import { applyDecorators } from '@nestjs/common';
import { ArrayNotEmpty } from 'class-validator';
import { OptionalField, type OptionalFieldOptions } from './optional-field';

export type ListFieldOptions = OptionalFieldOptions & {
  /**
   * How should empty lists be handled?
   */
  empty?: 'allow' | 'omit' | 'deny';
};

export const ListField = (typeFn: () => any, options: ListFieldOptions) =>
  applyDecorators(
    OptionalField(() => [typeFn()], {
      optional: false,
      ...options,
      transform: (value) => {
        let out = value ? [...new Set(value)] : value;
        out = options.empty === 'omit' && out.length === 0 ? undefined : out;
        return options.transform ? options.transform(out) : out;
      },
    }),
    ...(options.empty === 'deny' ? [ArrayNotEmpty()] : []),
  );
