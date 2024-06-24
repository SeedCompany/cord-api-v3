import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { uniq } from 'lodash';
import { rankSens } from '~/core/database/query';
import { DbSort } from './db-sort.decorator';
import { EnumType, makeEnum } from './make-enum';

export type Sensitivity = EnumType<typeof Sensitivity>;
export const Sensitivity = makeEnum({
  name: 'Sensitivity',
  values: ['Low', 'Medium', 'High'],
  exposeOrder: true,
});

export const SensitivityField = (options: FieldOptions = {}) =>
  applyDecorators(
    Field(() => Sensitivity, options),
    DbSort(rankSens),
  );

export const SensitivitiesFilter = () =>
  Transform(({ value }) => {
    const sens = uniq(value);
    return sens.length > 0 && sens.length < 3 ? sens : undefined;
  });
