import { Session } from '../../../../common';
import { PlanChange, UpdatePlanChange } from '../dto';

export class PlanChangeUpdatedEvent {
  constructor(
    public updated: PlanChange,
    readonly previous: PlanChange,
    readonly updates: UpdatePlanChange,
    readonly session: Session
  ) {}
}
