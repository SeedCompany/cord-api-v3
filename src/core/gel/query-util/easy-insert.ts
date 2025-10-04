import { type Cardinality } from 'gel/dist/reflection';
import type {
  ConditionalPick,
  RequireExactlyOne,
  KeyAsString as StringKeyOf,
} from 'type-fest';
import { type ID } from '~/common';
import { type AllResourceDBNames } from '~/core';
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
    ? $.typeutil.addQuestionMarks<
        InsertPointerValues<ConditionalPick<Shape, $.PropertyDesc>>
      > &
        AddIdSuffixOption<
          $.typeutil.addQuestionMarks<
            InsertPointerValues<ConditionalPick<Shape, $.LinkDesc>>
          >
        >
    : never;

type RawUpdateShape<Root extends $.ObjectTypeSet> = $.typeutil.stripNever<
  $.stripNonUpdateables<$.stripBacklinks<Root['__element__']['__pointers__']>>
> extends infer Shape
  ? Shape extends $.ObjectTypePointers
    ? UpdatePointerValues<ConditionalPick<Shape, $.PropertyDesc>> &
        AddIdSuffixOption<
          UpdatePointerValues<ConditionalPick<Shape, $.LinkDesc>>
        >
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

type AddIdSuffixOption<Links extends Record<string, any>> = {
  // cannot figure out how to get exclusive keys here to work.
  [K in StringKeyOf<Links>]: Partial<Record<K | `${K}Id`, Links[K]>>;
}[StringKeyOf<Links>];

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
