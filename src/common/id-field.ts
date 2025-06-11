import { applyDecorators } from '@nestjs/common';
import { ID as IDType } from '@nestjs/graphql';
import { type ValidationOptions } from 'class-validator';
import type { IsAny, IsNever, Tagged } from 'type-fest';
import type { ResourceName, ResourceNameLike } from '~/core';
import { OptionalField, type OptionalFieldOptions } from './optional-field';
import { IsId } from './validators';

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

export const isIdLike = (value: unknown): value is ID => typeof value === 'string';

export type ID<Kind extends IDKindLike = any> = Tagged<string, 'ID'> & IDTo<IDTag<Kind>>;

/** @deprecated Use {@link ID} */
export type IdOf<Kind extends IDKindLike> = ID<Kind>;

declare const IDTo: unique symbol;
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type IDTo<T> = { readonly [IDTo]: T };

// Normalize resource name if possible, otherwise use input directly
type IDTag<Kind> = IsAny<Kind> extends true
  ? any // continue to allow ID<any> to be assignable to any ID
  : ResourceName<Kind, true> extends infer Normalized
  ? IsNever<Normalized> extends false
    ? Normalized
    : Kind
  : never;

type IDKindLike = ResourceNameLike | object;
