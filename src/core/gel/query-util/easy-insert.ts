import { Cardinality } from 'gel/dist/reflection';
import {
  ConditionalPick,
  MergeExclusive,
  RequireExactlyOne,
  StringKeyOf,
} from 'type-fest';
import { ID } from '~/common';
import { AllResourceDBNames } from '~/core';
import {
  pointerToAssignmentExpression,
  setToAssignmentExpression,
} from '../generated-client/casting';
import { pointerIsOptional } from '../generated-client/insert';
import { $ } from '../reexports';

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
      > extends infer Shape
    ? Shape extends $.ObjectTypePointers
      ? $.typeutil.addQuestionMarks<
          InsertPointerValues<ConditionalPick<Shape, $.PropertyDesc>>
        > &
          AddIdSuffixOptionForInsert<
            $.typeutil.addQuestionMarks<
              InsertPointerValues<ConditionalPick<Shape, $.LinkDesc>>
            >
          >
      : never
    : never;

type RawUpdateShape<Root extends $.ObjectTypeSet> = $.typeutil.stripNever<
  $.stripNonUpdateables<$.stripBacklinks<Root['__element__']['__pointers__']>>
> extends infer Shape
  ? Shape extends $.ObjectTypePointers
    ? UpdatePointerValues<ConditionalPick<Shape, $.PropertyDesc>> &
        AddIdSuffixOptionForUpdate<
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

type AddIdSuffixOptionForInsert<Links extends Record<string, any>> = {
  [K in StringKeyOf<Links>]: MergeExclusive<
    $.typeutil.addQuestionMarks<Record<`${K}Id`, Links[K]>>,
    $.typeutil.addQuestionMarks<Record<K, Links[K]>>
  >;
}[StringKeyOf<Links>];

type AddIdSuffixOptionForUpdate<Links extends Record<string, any>> = {
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
