import { type Cardinality } from 'gel/dist/reflection';
import type { RequireExactlyOne } from 'type-fest';
import { type ID } from '~/common';
import type { AllResourceDBNames } from '~/core/resources';
import type {
  pointerToAssignmentExpression,
  setToAssignmentExpression,
} from '../generated-client/casting';
import type { pointerIsOptional } from '../generated-client/insert';
import { type $ } from '../reexports';

export type EasyInsertShape<Root extends $.ObjectTypeSet> = $.typeutil.flatten<
  RawInsertShape<Root>
>;

export type EasyUpdateShape<Root extends $.ObjectTypeSet> = $.typeutil.flatten<
  RawUpdateShape<Root>
>;

type RawInsertShape<Root extends $.ObjectTypeSet> =
  // short-circuit infinitely deep
  $.ObjectType extends Root['__element__']
    ? never
    : $.typeutil.stripNever<
          $.stripNonInsertables<
            $.stripBacklinks<Root['__element__']['__pointers__']>
          >
        > extends infer Shape extends $.ObjectTypePointers
      ? $.typeutil.addQuestionMarks<InsertPointerValues<Shape>>
      : never;

type RawUpdateShape<Root extends $.ObjectTypeSet> =
  $.typeutil.stripNever<
    $.stripNonUpdateables<$.stripBacklinks<Root['__element__']['__pointers__']>>
  > extends infer Shape
    ? Shape extends $.ObjectTypePointers
      ? UpdatePointerValues<Shape>
      : never
    : never;

type InsertPointerValues<Shape extends $.ObjectTypePointers> = {
  [k in keyof Shape]:
    | pointerToAssignmentExpression<Shape[k]>
    | AddIDsForLinks<Shape[k]>
    | AddNullability<Shape[k]>
    | (Shape[k]['hasDefault'] extends true ? undefined : never);
};

type UpdatePointerValues<Shape extends $.ObjectTypePointers> = {
  [k in keyof Shape]?:
    | pointerToAssignmentExpression<Shape[k]>
    | AddModifyMultiSet<Shape[k]>
    | AddIDsForLinks<Shape[k]>
    | AddNullability<Shape[k]>;
};

type AddModifyMultiSet<Pointer extends $.LinkDesc | $.PropertyDesc> =
  Pointer['cardinality'] extends Cardinality.Many | Cardinality.AtLeastOne
    ? RequireExactlyOne<
        Record<'+=' | '-=', pointerToAssignmentExpression<Pointer, true>>
      >
    : never;

type AddNullability<Pointer extends $.LinkDesc | $.PropertyDesc> =
  pointerIsOptional<Pointer> extends true ? undefined | null : never;

type AddIDsForLinks<Pointer extends $.LinkDesc | $.PropertyDesc> =
  Pointer extends $.LinkDesc<infer TargetType, infer Cardinality>
    ? AsIDs<
        TargetType['__name__'] extends AllResourceDBNames
          ? ID<TargetType['__name__']>
          : ID,
        Cardinality
      >
    : never;

type AsIDs<IDType, Card extends $.Cardinality> = setToAssignmentExpression<
  $.TypeSet<$.ScalarType<string, IDType>, Card>,
  false
>;
