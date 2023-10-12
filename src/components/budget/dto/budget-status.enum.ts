import { EnumType, makeEnum } from '~/common';

export type BudgetStatus = EnumType<typeof BudgetStatus>;
export const BudgetStatus = makeEnum({
  name: 'BudgetStatus',
  values: ['Pending', 'Current', 'Superceded', 'Rejected'],
});
