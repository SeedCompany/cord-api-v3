import { Role } from '~/common';
import type { AuthScope } from '../../components/authorization/dto';
import e from './generated-client';
import { orScalarLiteral } from './generated-client/castMaps';
import { $str } from './generated-client/modules/std';
import * as $ from './generated-client/reflection';

/**
 * Prefixes scope given to roles given.
 * This mainly exists so the output type is a ScopedRole instead of a string.
 * @example TS
 * scopedRoles: withScope('global', user.roles),
 * @example EdgeQL
 * scopedRoles := 'global:' ++ <str>.roles
 */
export const withScope = <
  Scope extends AuthScope,
  RoleExpr extends orScalarLiteral<$.TypeSet>,
>(
  scope: Scope,
  roles: RoleExpr,
) =>
  e.op(e.str(scope + ':'), '++', e.cast(e.str, roles)) as $.$expr_Operator<
    $str<`${Scope}:${Role}`>,
    $.cardutil.paramCardinality<RoleExpr>
  >;
