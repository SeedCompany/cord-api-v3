// GENERATED by @gel/generate v0.6.2

import * as $ from "../../reflection";
import * as _ from "../../imports";
import type * as _std from "../std";
type lgλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
type lgλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the base 10 logarithm of the input value.
 */
function lg<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): lgλFuncExpr<P1>;
/**
 * Return the base 10 logarithm of the input value.
 */
function lg<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  x: P1,
): lgλFuncExpr2<P1>;
function lg(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::lg', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::lg",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type logλFuncExpr<
  NamedArgs extends {
    "base": _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  },
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.multiplyCardinalities<$.cardutil.paramCardinality<P1>, $.cardutil.paramCardinality<NamedArgs["base"]>>
>;
/**
 * Return the logarithm of the input value in the specified *base*.
 */
function log<
  NamedArgs extends {
    "base": _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
  },
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  namedArgs: NamedArgs,
  x: P1,
): logλFuncExpr<NamedArgs, P1>;
function log(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::log', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], namedArgs: {"base": {typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}}, returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::log",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type sqrtλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
type sqrtλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the square root of the input value.
 */
function sqrt<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): sqrtλFuncExpr<P1>;
/**
 * Return the square root of the input value.
 */
function sqrt<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  x: P1,
): sqrtλFuncExpr2<P1>;
function sqrt(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::sqrt', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::sqrt",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type absλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyreal>>,
> = $.$expr_Function<
  _std.$anyreal, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the absolute value of the input *x*.
 */
function abs<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$anyreal>>,
>(
  x: P1,
): absλFuncExpr<P1>;
function abs(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::abs', args, _.spec, [
    {args: [{typeId: "04976545-1176-5536-8673-c9f7d18d581b", optional: false, setoftype: false, variadic: false}], returnTypeId: "04976545-1176-5536-8673-c9f7d18d581b"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::abs",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type ceilλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
type ceilλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
> = $.$expr_Function<
  _std.$bigint, $.cardutil.paramCardinality<P1>
>;
type ceilλFuncExpr3<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.paramCardinality<P1>
>;
/**
 * Round up to the nearest integer.
 */
function ceil<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): ceilλFuncExpr<P1>;
/**
 * Round up to the nearest integer.
 */
function ceil<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  x: P1,
): ceilλFuncExpr2<P1>;
/**
 * Round up to the nearest integer.
 */
function ceil<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  x: P1,
): ceilλFuncExpr3<P1>;
function ceil(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::ceil', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::ceil",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type floorλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
type floorλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
> = $.$expr_Function<
  _std.$bigint, $.cardutil.paramCardinality<P1>
>;
type floorλFuncExpr3<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.paramCardinality<P1>
>;
/**
 * Round down to the nearest integer.
 */
function floor<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): floorλFuncExpr<P1>;
/**
 * Round down to the nearest integer.
 */
function floor<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$bigint>>,
>(
  x: P1,
): floorλFuncExpr2<P1>;
/**
 * Round down to the nearest integer.
 */
function floor<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  x: P1,
): floorλFuncExpr3<P1>;
function floor(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::floor', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000110", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000110"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::floor",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type lnλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
type lnλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the natural logarithm of the input value.
 */
function ln<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): lnλFuncExpr<P1>;
/**
 * Return the natural logarithm of the input value.
 */
function ln<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  x: P1,
): lnλFuncExpr2<P1>;
function ln(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::ln', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::ln",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type meanλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.Cardinality.One
>;
type meanλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.Cardinality.One
>;
/**
 * Return the arithmetic mean of the input set.
 */
function mean<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  vals: P1,
): meanλFuncExpr<P1>;
/**
 * Return the arithmetic mean of the input set.
 */
function mean<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  vals: P1,
): meanλFuncExpr2<P1>;
function mean(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::mean', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::mean",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type stddevλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.Cardinality.One
>;
type stddevλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.Cardinality.One
>;
/**
 * Return the sample standard deviation of the input set.
 */
function stddev<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  vals: P1,
): stddevλFuncExpr<P1>;
/**
 * Return the sample standard deviation of the input set.
 */
function stddev<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  vals: P1,
): stddevλFuncExpr2<P1>;
function stddev(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::stddev', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::stddev",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type stddev_popλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.Cardinality.One
>;
type stddev_popλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.Cardinality.One
>;
/**
 * Return the population standard deviation of the input set.
 */
function stddev_pop<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  vals: P1,
): stddev_popλFuncExpr<P1>;
/**
 * Return the population standard deviation of the input set.
 */
function stddev_pop<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  vals: P1,
): stddev_popλFuncExpr2<P1>;
function stddev_pop(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::stddev_pop', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::stddev_pop",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type var_6499cc9d9d4c58bcaa35075aa52c9823λFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.overrideLowerBound<$.Cardinality.One, "Zero">
>;
type var_6499cc9d9d4c58bcaa35075aa52c9823λFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.overrideLowerBound<$.Cardinality.One, "Zero">
>;
/**
 * Return the sample variance of the input set.
 */
function var_6499cc9d9d4c58bcaa35075aa52c9823<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  vals: P1,
): var_6499cc9d9d4c58bcaa35075aa52c9823λFuncExpr<P1>;
/**
 * Return the sample variance of the input set.
 */
function var_6499cc9d9d4c58bcaa35075aa52c9823<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  vals: P1,
): var_6499cc9d9d4c58bcaa35075aa52c9823λFuncExpr2<P1>;
function var_6499cc9d9d4c58bcaa35075aa52c9823(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::var', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff", returnTypemod: "OptionalType"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108", returnTypemod: "OptionalType"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::var",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type var_popλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.overrideLowerBound<$.Cardinality.One, "Zero">
>;
type var_popλFuncExpr2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
> = $.$expr_Function<
  _std.$decimal, $.cardutil.overrideLowerBound<$.Cardinality.One, "Zero">
>;
/**
 * Return the population variance of the input set.
 */
function var_pop<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  vals: P1,
): var_popλFuncExpr<P1>;
/**
 * Return the population variance of the input set.
 */
function var_pop<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$decimalλICastableTo>>,
>(
  vals: P1,
): var_popλFuncExpr2<P1>;
function var_pop(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::var_pop', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff", returnTypemod: "OptionalType"},
    {args: [{typeId: "00000000-0000-0000-0000-000000000108", optional: false, setoftype: true, variadic: false}], returnTypeId: "00000000-0000-0000-0000-000000000108", returnTypemod: "OptionalType"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::var_pop",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type piλFuncExpr = $.$expr_Function<
  _std.$number, $.Cardinality.One
>;
/**
 * Return the constant value of pi.
 */
function pi(): piλFuncExpr;
function pi(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::pi', args, _.spec, [
    {args: [], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::pi",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type acosλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the inverse cosine of the input value.
 */
function acos<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): acosλFuncExpr<P1>;
function acos(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::acos', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::acos",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type asinλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the inverse sine of the input value.
 */
function asin<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): asinλFuncExpr<P1>;
function asin(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::asin', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::asin",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type atanλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the inverse tangent of the input value.
 */
function atan<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): atanλFuncExpr<P1>;
function atan(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::atan', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::atan",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type atan2λFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.multiplyCardinalities<$.cardutil.paramCardinality<P1>, $.cardutil.paramCardinality<P2>>
>;
/**
 * Return the inverse tangent of y/x of the input value.
 */
function atan2<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
  P2 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  y: P1,
  x: P2,
): atan2λFuncExpr<P1, P2>;
function atan2(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::atan2', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}, {typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::atan2",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type cosλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the cosine of the input value.
 */
function cos<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): cosλFuncExpr<P1>;
function cos(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::cos', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::cos",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type cotλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the cotangent of the input value.
 */
function cot<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): cotλFuncExpr<P1>;
function cot(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::cot', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::cot",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type sinλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the sine of the input value.
 */
function sin<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): sinλFuncExpr<P1>;
function sin(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::sin', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::sin",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type tanλFuncExpr<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
> = $.$expr_Function<
  _std.$number, $.cardutil.paramCardinality<P1>
>;
/**
 * Return the tangent of the input value.
 */
function tan<
  P1 extends _.castMaps.orScalarLiteral<$.TypeSet<_std.$number>>,
>(
  x: P1,
): tanλFuncExpr<P1>;
function tan(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('std::math::tan', args, _.spec, [
    {args: [{typeId: "00000000-0000-0000-0000-0000000001ff", optional: false, setoftype: false, variadic: false}], returnTypeId: "00000000-0000-0000-0000-0000000001ff"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "std::math::tan",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};



type __defaultExports = {
  "lg": typeof lg;
  "log": typeof log;
  "sqrt": typeof sqrt;
  "abs": typeof abs;
  "ceil": typeof ceil;
  "floor": typeof floor;
  "ln": typeof ln;
  "mean": typeof mean;
  "stddev": typeof stddev;
  "stddev_pop": typeof stddev_pop;
  "var": typeof var_6499cc9d9d4c58bcaa35075aa52c9823;
  "var_pop": typeof var_pop;
  "pi": typeof pi;
  "acos": typeof acos;
  "asin": typeof asin;
  "atan": typeof atan;
  "atan2": typeof atan2;
  "cos": typeof cos;
  "cot": typeof cot;
  "sin": typeof sin;
  "tan": typeof tan
};
const __defaultExports: __defaultExports = {
  "lg": lg,
  "log": log,
  "sqrt": sqrt,
  "abs": abs,
  "ceil": ceil,
  "floor": floor,
  "ln": ln,
  "mean": mean,
  "stddev": stddev,
  "stddev_pop": stddev_pop,
  "var": var_6499cc9d9d4c58bcaa35075aa52c9823,
  "var_pop": var_pop,
  "pi": pi,
  "acos": acos,
  "asin": asin,
  "atan": atan,
  "atan2": atan2,
  "cos": cos,
  "cot": cot,
  "sin": sin,
  "tan": tan
};
export default __defaultExports;
