import { many, mapEntries } from '@seedcompany/common';
import { ID, ServerException } from '~/common';
import { $, e } from '../reexports';

export const mapToSetBlock = (
  type: $.$expr_PathNode,
  changes: Record<string, any>,
) => {
  const el = type.__element__;
  const pointers = el.__pointers__;

  return mapEntries(changes, ([key, value], { SKIP }) => {
    // If some kind of EdgeQL expression, use as-is
    if (
      typeof value === 'object' &&
      ('toEdgeQL' in value || '+=' in value || '-=' in value)
    ) {
      return [key, value];
    }

    // strip our xId suffix
    const pointerKey =
      !(key in pointers) && key.endsWith('Id') && key.slice(0, -2) in pointers
        ? (key.slice(0, -2) as keyof typeof pointers)
        : (key as keyof typeof pointers);

    const pointer = pointers[pointerKey];
    if (!pointer || pointer.readonly || pointer.computed) {
      throw new ServerException(`Cannot update ${el.__name__}.${pointerKey}`);
    }
    if (value === undefined) {
      return SKIP;
    }

    const eqlValue =
      value === null
        ? null
        : pointer.__kind__ === 'property'
        ? value
        : e.cast(
            pointer.target,
            e.set(...many(value).map((v) => e.uuid(v as ID))),
          );

    return [pointerKey, eqlValue];
  }).asRecord;
};
