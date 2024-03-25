import { Module } from '@nestjs/common';
import { RoleAndExpUnionOptimizer } from '../policies/conditions/role-and-exp-union.optimizer';
import { VariantAndExpUnionOptimizer } from '../policies/conditions/variant-and-exp-union.optimizer';
import { FlattenAggregateOptimizer } from './conditions/flatten-aggregate.optimizer';
import { EdgeDBAccessPolicyGenerator } from './edgedb-access-policy.generator';
import { ConditionOptimizer } from './executor/condition-optimizer';
import { PolicyDumpCommand, PolicyDumper } from './executor/policy-dumper';
import { PolicyExecutor } from './executor/policy-executor';
import { Privileges } from './executor/privileges';
import { GrantersFactory } from './granters.factory';
import { PolicyFactory } from './policy.factory';

@Module({
  providers: [
    GrantersFactory,
    PolicyFactory,
    PolicyExecutor,
    Privileges,
    PolicyDumper,
    PolicyDumpCommand,
    ConditionOptimizer,
    EdgeDBAccessPolicyGenerator,
    RoleAndExpUnionOptimizer,
    VariantAndExpUnionOptimizer,
    FlattenAggregateOptimizer,
  ],
  exports: [Privileges, EdgeDBAccessPolicyGenerator],
})
export class PolicyModule {}
