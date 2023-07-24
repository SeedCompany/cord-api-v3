import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions } from '@nestjs/graphql';
import { Transform } from './transform.decorator';
import { IsEmail } from './validators';

export const EmailField = (options: FieldOptions = {}) =>
  applyDecorators(
    Field(() => String, options),
    Transform(({ value }) => value?.toLowerCase()),
    IsEmail(),
  );
