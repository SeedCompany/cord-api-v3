import { applyDecorators } from '@nestjs/common';
import { Field, type FieldOptions } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import { IsEmail } from '~/common/validators';

export const EmailField = (options: FieldOptions = {}) =>
  applyDecorators(
    Field(() => String, options),
    Transform(({ value }) => (value ? value.toLowerCase() : value)),
    IsEmail(),
  );
