import { applyDecorators } from '@nestjs/common';
import { ID as IDType } from '@nestjs/graphql';
import { type ValidationOptions } from 'class-validator';
import { IsId } from '~/common/validators';
import { OptionalField, type OptionalFieldOptions } from './optional.field';

export const IdField = ({
  validation,
  ...options
}: OptionalFieldOptions & { validation?: ValidationOptions } = {}) =>
  applyDecorators(
    OptionalField(() => IDType, {
      optional: false,
      ...options,
    }),
    IsId(validation),
  );
