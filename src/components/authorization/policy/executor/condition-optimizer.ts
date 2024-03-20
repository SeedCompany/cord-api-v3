import { DiscoveryService } from '@golevelup/nestjs-discovery';
import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  AggregateConditions,
  AndConditions,
  Condition,
  Optimizer,
  OrConditions,
} from '../conditions';

@Injectable()
export class ConditionOptimizer implements OnModuleInit {
  private optimizers: Optimizer[];

  constructor(private readonly discovery: DiscoveryService) {}

  async onModuleInit() {
    const found = await this.discovery.providersWithMetaAtKey(Optimizer as any);
    this.optimizers = found.map((p) => p.discoveredClass.instance as Optimizer);
  }

  optimize(condition: Condition) {
    let current = condition;
    let prev;
    while (current !== prev) {
      prev = current;
      // If an optimizer has applied a change, give optimizers another chance on the entire tree
      current = this.doOptimize(current);
    }
    return current;
  }

  private doOptimize(condition: Condition) {
    // Optimize leaves first, walking up to root.
    // This means smaller expressions are optimized before tackling larger ones.
    if (condition instanceof AggregateConditions) {
      let changed = false;
      const newSubs = condition.conditions.map((sub) => {
        const next = this.doOptimize(sub);
        if (next !== sub) {
          changed = true;
        }
        return next;
      });
      // Only change aggregate identity if children have changed
      if (changed) {
        condition =
          condition instanceof AndConditions
            ? AndConditions.from(...newSubs)
            : OrConditions.from(...newSubs);
      }
    }

    return this.optimizers.reduce(
      (current, optimizer) => optimizer.optimize(current),
      condition,
    );
  }
}
