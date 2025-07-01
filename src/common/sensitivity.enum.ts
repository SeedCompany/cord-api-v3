import { applyDecorators } from '@nestjs/common';
import { type EnumType, makeEnum } from '@seedcompany/nest';
import { rankSens } from '~/core/database/query';
import { DbSort } from './db-sort.decorator';
import { ListField, type ListFieldOptions } from './list-field';
import { OptionalField, type OptionalFieldOptions } from './optional-field';

export type Sensitivity = EnumType<typeof Sensitivity>;
export const Sensitivity = makeEnum({
  name: 'Sensitivity',
  values: ['Low', 'Medium', 'High'],
  exposeOrder: true,
});

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
