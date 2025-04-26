import { applyDecorators } from '@nestjs/common';
import { OptionalField, OptionalFieldOptions } from './optional-field';

export type ListFieldOptions = OptionalFieldOptions;

export const ListField = (typeFn: () => any, options: ListFieldOptions) =>
  applyDecorators(
    OptionalField(() => [typeFn()], {
      optional: false,
      ...options,
      transform: (value) => {
        const deduped = value ? [...new Set(value)] : value;
        return options.transform ? options.transform(deduped) : value;
      },
    }),
  );
