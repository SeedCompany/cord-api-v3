import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { MinLength } from 'class-validator';

export const NameField = (options?: FieldOptions) =>
  applyDecorators(
    Field(() => String, options),
    Transform((value) => {
      return value ? value.trim() : value;
    }) as PropertyDecorator,
    MinLength(2)
  );
