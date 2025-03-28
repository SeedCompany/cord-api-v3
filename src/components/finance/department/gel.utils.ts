import { Nil } from '@seedcompany/common';
import { $, e } from '~/core/gel';
import { FinanceDepartmentIdBlockInput as Input } from './dto/id-blocks.input';

export const hydrate = e.shape(e.Finance.Department.IdBlock, (block) => ({
  id: true,
  blocks: e.for(
    e.assert_exists(e.op('distinct', e.multirange_unpack(block.range))),
    (range) =>
      e.select({
        start: e.assert_exists(e.range_get_lower(range)),
        end: e.op(e.assert_exists(e.range_get_upper(range)), '-', 1),
      }),
  ),
  programs: true,
}));

export const insertMaybe = (input: Input | Nil) =>
  !input ? undefined : insert(input);

export const setMaybe = (ref: IdBlockOptionalRef, input: Input | Nil) =>
  input === undefined ? undefined : set(ref, input);

export const insert = (input: Input) =>
  e.insert(e.Finance.Department.IdBlock, inputForGel(input));

export const set = (ref: IdBlockOptionalRef, input: Input | null) =>
  input ? upsert(ref, input) : e.delete(ref);

export const upsert = (ref: IdBlockOptionalRef, input: Input) =>
  e.op(
    e.update(ref, () => ({
      set: inputForGel(input),
    })),
    '??',
    insert(input),
  );

const inputForGel = (input: Input) => {
  const ranges = input.blocks.map((range) =>
    e.range(range.start, range.end + 1),
  );
  return {
    range: e.multirange(e.array(asNonEmpty(ranges))),
    programs: input.programs,
  };
};

const asNonEmpty = <T>(list: readonly T[]) => {
  if (list.length === 0) {
    throw new Error('List is empty');
  }
  return list as [T, ...T[]];
};

type IdBlockOptionalRef = $.$expr_PathNode<
  $.TypeSet<
    typeof e.Finance.Department.IdBlock.__element__,
    $.Cardinality.AtMostOne
  >
>;
