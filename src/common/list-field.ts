import { applyDecorators } from '@nestjs/common';
import { ArrayNotEmpty } from 'class-validator';
import {
  OptionalField,
  type OptionalFieldOptions,
  withDefaultTransform,
} from './optional-field';

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
      transform: withDefaultTransform(options.transform, (prev) => (raw) => {
        const value = prev(raw);
        let out = value ? [...new Set(value)] : value;
        out = options.empty === 'omit' && out.length === 0 ? undefined : out;
        return out;
      }),
    }),
    ...(options.empty === 'deny' ? [ArrayNotEmpty()] : []),
  );
