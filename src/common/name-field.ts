import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions } from '@nestjs/graphql';
import { MinLength } from 'class-validator';
import { DbSort } from './db-sort.decorator';
import { Transform } from './transform.decorator';

export const NameField = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => String, options),
    Transform(({ value }) => value?.trim()),
    DbSort((value) => `toLower(${value})`),
    MinLength(1)
  );
