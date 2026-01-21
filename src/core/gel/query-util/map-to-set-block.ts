import { many, mapEntries } from '@seedcompany/common';
import { ServerException } from '~/common';
import { type $, e } from '../reexports';

export const mapToSetBlock = (
  type: $.$expr_PathNode,
  changes: Record<string, any>,
  enforceReadonly: boolean,
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

    const pointer = pointers[key as keyof typeof pointers];
    if (!pointer) {
      throw new ServerException(`Cannot find ${el.__name__}.${key}`);
    }
    if (pointer.computed) {
      throw new ServerException(
        `Cannot set computed pointer ${el.__name__}.${key}`,
      );
    }
    if (enforceReadonly && pointer.readonly) {
      throw new ServerException(`Cannot update ${el.__name__}.${key}`);
    }
    if (value === undefined) {
      return SKIP;
    }

    const eqlValue =
      value === null
        ? null
        : pointer.__kind__ === 'property'
          ? value
          : e.cast(pointer.target, e.cast(e.uuid, e.set(...many(value))));

    return [key, eqlValue];
  }).asRecord;
};
