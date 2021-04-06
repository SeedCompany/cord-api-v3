import { applyDecorators } from '@nestjs/common';
import { Field, FieldOptions, ID as IDType } from '@nestjs/graphql';
import { ValidationOptions } from 'class-validator';
import { Opaque } from 'type-fest';
import { IsId } from './validators';

export const IdField = ({
  validation,
  ...options
}: FieldOptions & { validation?: ValidationOptions } = {}) =>
  applyDecorators(
    Field(() => IDType, options),
    IsId(validation)
  );

export type ID = Opaque<string, 'ID'>;

export const isIdLike = (value: unknown): value is ID =>
  typeof value === 'string';
