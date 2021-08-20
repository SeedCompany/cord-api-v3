import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions, registerEnumType } from '@nestjs/graphql';
import { rankSens } from '../core/database/query';
import { DbSort } from './db-sort.decorator';

export enum Sensitivity {
  Low = 'Low',
  Medium = 'Medium',
  High = 'High',
}

registerEnumType(Sensitivity, {
  name: 'Sensitivity',
});

export const SensitivityField = (options: FieldOptions = {}) =>
  applyDecorators(
    Field(() => Sensitivity, options),
    DbSort(rankSens)
  );
