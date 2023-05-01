import { PipeTransform } from '@nestjs/common';
import type { ChangesetAware } from '../components/changeset/dto';
import { FieldSelection, isOnlyGivenKeys } from './field-selection';
import type { Resource } from './resource.dto';

/**
 * Returns the fields requested by the operation (requester).
 * @example
 * ```
 * @Info(Fields) fields: FieldInfo<Foo>
 * ```
 */
export const Fields = FieldSelection;

/**
 * Converts the field info to a boolean if the only fields asked for are in this list.
 * @example
 * ```
 * @Info(Fields, IsOnly(['id'])) onlyId: boolean
 * ```
 */
export const IsOnly = <T>(
  fields: Array<keyof T & string>,
): PipeTransform<FieldSelection, boolean> => ({
  transform: (selection) => isOnlyGivenKeys(selection.forAllTypes, fields),
});

/**
 * Converts the field info to a boolean if the only field asked for is the ID.
 * @example
 * ```
 * @Info(Fields, IsOnlyId) onlyId: boolean
 * ```
 */
export const IsOnlyId = IsOnly<Resource & ChangesetAware>(['id', 'changeset']);
