import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions, ID } from '@nestjs/graphql';
import { ValidationOptions } from 'class-validator';
import { IsId } from './validators';

export const IdField = ({
  validation,
  ...options
}: FieldOptions & { validation?: ValidationOptions } = {}) =>
  applyDecorators(
    Field(() => ID, options),
    IsId(validation)
  );
