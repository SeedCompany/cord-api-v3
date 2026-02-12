import { applyDecorators } from '@nestjs/common';
import { DbSort } from '~/common/db';
import { Sensitivity } from '~/common/enums';
import { rankSens } from '~/core/database/query';
import { ListField, type ListFieldOptions } from './list.field';
import { OptionalField, type OptionalFieldOptions } from './optional.field';

export const SensitivityField = (options?: OptionalFieldOptions) =>
  applyDecorators(
    OptionalField(() => Sensitivity, {
      optional: false,
      ...options,
    }),
    DbSort(rankSens),
  );

export const SensitivitiesFilterField = (options?: ListFieldOptions) =>
  ListField(() => Sensitivity, {
    description: 'Only these sensitivities',
    ...options,
    optional: true,
    empty: 'omit',
    transform: (prev) => (raw) => {
      const value = prev(raw);
      // If given all options, there is no need to filter
      return !value || value.length === Sensitivity.values.size
        ? undefined
        : value;
    },
  });
