// GENERATED by @gel/generate v0.6.2

import * as $ from "../reflection";
import * as _ from "../imports";
import type * as _schema from "./schema";
import type * as _std from "./std";
export type $TransactionIsolation = {
  "RepeatableRead": $.$expr_Literal<$TransactionIsolation>;
  "Serializable": $.$expr_Literal<$TransactionIsolation>;
} & $.EnumType<"sys::TransactionIsolation", ["RepeatableRead", "Serializable"]>;
const TransactionIsolation: $TransactionIsolation = $.makeType<$TransactionIsolation>(_.spec, "070715f3-0100-5580-9473-696f961243eb", _.syntax.literal);

export type $VersionStage = {
  "dev": $.$expr_Literal<$VersionStage>;
  "alpha": $.$expr_Literal<$VersionStage>;
  "beta": $.$expr_Literal<$VersionStage>;
  "rc": $.$expr_Literal<$VersionStage>;
  "final": $.$expr_Literal<$VersionStage>;
} & $.EnumType<"sys::VersionStage", ["dev", "alpha", "beta", "rc", "final"]>;
const VersionStage: $VersionStage = $.makeType<$VersionStage>(_.spec, "16a08f13-b1b1-57f4-8e82-062f67fb2a4c", _.syntax.literal);

export type $SystemObjectλShape = $.typeutil.flatten<_schema.$Object_32faaa35947553cf88fce68ecf1be4d9λShape & {
}>;
type $SystemObject = $.ObjectType<"sys::SystemObject", $SystemObjectλShape, null, [
  ..._schema.$Object_32faaa35947553cf88fce68ecf1be4d9['__exclusives__'],
], "sys::Database" | "sys::ExtensionPackage" | "sys::Role">;
const $SystemObject = $.makeType<$SystemObject>(_.spec, "43f8d5e9-5b2e-535b-a46b-acf8af101718", _.syntax.literal);

const SystemObject: $.$expr_PathNode<$.TypeSet<$SystemObject, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($SystemObject, $.Cardinality.Many), null);

export type $ExternalObjectλShape = $.typeutil.flatten<$SystemObjectλShape & {
}>;
type $ExternalObject = $.ObjectType<"sys::ExternalObject", $ExternalObjectλShape, null, [
  ...$SystemObject['__exclusives__'],
], "sys::Database">;
const $ExternalObject = $.makeType<$ExternalObject>(_.spec, "e3838826-d523-59f9-86f4-be3cecdf0d4f", _.syntax.literal);

const ExternalObject: $.$expr_PathNode<$.TypeSet<$ExternalObject, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($ExternalObject, $.Cardinality.Many), null);

export type $DatabaseλShape = $.typeutil.flatten<$ExternalObjectλShape & _schema.$AnnotationSubjectλShape & {
  "name": $.PropertyDesc<_std.$str, $.Cardinality.One, true, false, false, false>;
}>;
type $Database = $.ObjectType<"sys::Database", $DatabaseλShape, null, [
  ...$ExternalObject['__exclusives__'],
  ..._schema.$AnnotationSubject['__exclusives__'],
  {name: {__element__: _std.$str, __cardinality__: $.Cardinality.One | $.Cardinality.AtMostOne },},
], "sys::Database">;
const $Database = $.makeType<$Database>(_.spec, "fd469647-1cf1-5702-85b6-bbdb7e7f1c7e", _.syntax.literal);

const Database: $.$expr_PathNode<$.TypeSet<$Database, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($Database, $.Cardinality.Many), null);

export type $ExtensionPackageλShape = $.typeutil.flatten<$SystemObjectλShape & _schema.$AnnotationSubjectλShape & {
  "script": $.PropertyDesc<_std.$str, $.Cardinality.One, false, false, false, false>;
  "version": $.PropertyDesc<$.NamedTupleType<{major: _std.$int64, minor: _std.$int64, stage: $VersionStage, stage_no: _std.$int64, local: $.ArrayType<_std.$str>}>, $.Cardinality.One, false, false, false, false>;
  "<package[is schema::Extension]": $.LinkDesc<_schema.$Extension, $.Cardinality.AtMostOne, {}, true, false,  false, false>;
  "<package": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $ExtensionPackage = $.ObjectType<"sys::ExtensionPackage", $ExtensionPackageλShape, null, [
  ...$SystemObject['__exclusives__'],
  ..._schema.$AnnotationSubject['__exclusives__'],
], "sys::ExtensionPackage">;
const $ExtensionPackage = $.makeType<$ExtensionPackage>(_.spec, "87787989-1e54-5529-9cc4-524cc873528d", _.syntax.literal);

const ExtensionPackage: $.$expr_PathNode<$.TypeSet<$ExtensionPackage, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($ExtensionPackage, $.Cardinality.Many), null);

export type $RoleλShape = $.typeutil.flatten<$SystemObjectλShape & _schema.$InheritingObjectλShape & _schema.$AnnotationSubjectλShape & {
  "name": $.PropertyDesc<_std.$str, $.Cardinality.One, true, false, false, false>;
  "superuser": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, false, false, false>;
  "is_superuser": $.PropertyDesc<_std.$bool, $.Cardinality.One, false, true, false, false>;
  "password": $.PropertyDesc<_std.$str, $.Cardinality.AtMostOne, false, false, false, false>;
  "member_of": $.LinkDesc<$Role, $.Cardinality.Many, {}, false, false,  false, false>;
  "<member_of[is sys::Role]": $.LinkDesc<$Role, $.Cardinality.Many, {}, false, false,  false, false>;
  "<member_of": $.LinkDesc<$.ObjectType, $.Cardinality.Many, {}, false, false,  false, false>;
}>;
type $Role = $.ObjectType<"sys::Role", $RoleλShape, null, [
  ...$SystemObject['__exclusives__'],
  ..._schema.$InheritingObject['__exclusives__'],
  ..._schema.$AnnotationSubject['__exclusives__'],
  {name: {__element__: _std.$str, __cardinality__: $.Cardinality.One | $.Cardinality.AtMostOne },},
], "sys::Role">;
const $Role = $.makeType<$Role>(_.spec, "04d3804d-c37f-5969-86b2-a24309653b14", _.syntax.literal);

const Role: $.$expr_PathNode<$.TypeSet<$Role, $.Cardinality.Many>, null> = _.syntax.$PathNode($.$toSet($Role, $.Cardinality.Many), null);

type get_versionλFuncExpr = $.$expr_Function<
  $.NamedTupleType<{major: _std.$int64, minor: _std.$int64, stage: $VersionStage, stage_no: _std.$int64, local: $.ArrayType<_std.$str>}>, $.Cardinality.One
>;
/**
 * Return the server version as a tuple.
 */
function get_version(): get_versionλFuncExpr;
function get_version(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('sys::get_version', args, _.spec, [
    {args: [], returnTypeId: "48a4615d-2402-5744-bd11-17015ad18bb9"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "sys::get_version",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type get_version_as_strλFuncExpr = $.$expr_Function<
  _std.$str, $.Cardinality.One
>;
/**
 * Return the server version as a string.
 */
function get_version_as_str(): get_version_as_strλFuncExpr;
function get_version_as_str(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('sys::get_version_as_str', args, _.spec, [
    {args: [], returnTypeId: "00000000-0000-0000-0000-000000000101"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "sys::get_version_as_str",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type get_instance_nameλFuncExpr = $.$expr_Function<
  _std.$str, $.Cardinality.One
>;
/**
 * Return the server instance name.
 */
function get_instance_name(): get_instance_nameλFuncExpr;
function get_instance_name(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('sys::get_instance_name', args, _.spec, [
    {args: [], returnTypeId: "00000000-0000-0000-0000-000000000101"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "sys::get_instance_name",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type get_transaction_isolationλFuncExpr = $.$expr_Function<
  $TransactionIsolation, $.Cardinality.One
>;
/**
 * Return the isolation level of the current transaction.
 */
function get_transaction_isolation(): get_transaction_isolationλFuncExpr;
function get_transaction_isolation(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('sys::get_transaction_isolation', args, _.spec, [
    {args: [], returnTypeId: "070715f3-0100-5580-9473-696f961243eb"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "sys::get_transaction_isolation",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type get_current_databaseλFuncExpr = $.$expr_Function<
  _std.$str, $.Cardinality.One
>;
/**
 * Return the name of the current database branch as a string.
 */
function get_current_database(): get_current_databaseλFuncExpr;
function get_current_database(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('sys::get_current_database', args, _.spec, [
    {args: [], returnTypeId: "00000000-0000-0000-0000-000000000101"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "sys::get_current_database",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};

type get_current_branchλFuncExpr = $.$expr_Function<
  _std.$str, $.Cardinality.One
>;
/**
 * Return the name of the current database branch as a string.
 */
function get_current_branch(): get_current_branchλFuncExpr;
function get_current_branch(...args: any[]) {
  const {returnType, cardinality, args: positionalArgs, namedArgs} = _.syntax.$resolveOverload('sys::get_current_branch', args, _.spec, [
    {args: [], returnTypeId: "00000000-0000-0000-0000-000000000101"},
  ]);
  return _.syntax.$expressionify({
    __kind__: $.ExpressionKind.Function,
    __element__: returnType,
    __cardinality__: cardinality,
    __name__: "sys::get_current_branch",
    __args__: positionalArgs,
    __namedargs__: namedArgs,
  }) as any;
};



export { TransactionIsolation, VersionStage, $SystemObject, SystemObject, $ExternalObject, ExternalObject, $Database, Database, $ExtensionPackage, ExtensionPackage, $Role, Role };

type __defaultExports = {
  "TransactionIsolation": typeof TransactionIsolation;
  "VersionStage": typeof VersionStage;
  "SystemObject": typeof SystemObject;
  "ExternalObject": typeof ExternalObject;
  "Database": typeof Database;
  "ExtensionPackage": typeof ExtensionPackage;
  "Role": typeof Role;
  "get_version": typeof get_version;
  "get_version_as_str": typeof get_version_as_str;
  "get_instance_name": typeof get_instance_name;
  "get_transaction_isolation": typeof get_transaction_isolation;
  "get_current_database": typeof get_current_database;
  "get_current_branch": typeof get_current_branch
};
const __defaultExports: __defaultExports = {
  "TransactionIsolation": TransactionIsolation,
  "VersionStage": VersionStage,
  "SystemObject": SystemObject,
  "ExternalObject": ExternalObject,
  "Database": Database,
  "ExtensionPackage": ExtensionPackage,
  "Role": Role,
  "get_version": get_version,
  "get_version_as_str": get_version_as_str,
  "get_instance_name": get_instance_name,
  "get_transaction_isolation": get_transaction_isolation,
  "get_current_database": get_current_database,
  "get_current_branch": get_current_branch
};
export default __defaultExports;
