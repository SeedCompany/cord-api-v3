import { applyDecorators } from '@nestjs/common';
import { EnumType, makeEnum } from '@seedcompany/nest';
import { Transform } from 'class-transformer';
import { uniq } from 'lodash';
import { rankSens } from '~/core/database/query';
import { DbSort } from './db-sort.decorator';
import { OptionalField, OptionalFieldOptions } from './optional-field';

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

export const SensitivitiesFilter = () =>
  Transform(({ value }) => {
    const sens = uniq(value);
    return sens.length > 0 && sens.length < 3 ? sens : undefined;
  });
