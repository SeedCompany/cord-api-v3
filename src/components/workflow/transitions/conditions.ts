import { Promisable } from 'type-fest';

export interface TransitionCondition<Params> {
  description: string;
  resolve: (params: Params) => Promisable<{
    status: 'ENABLED' | 'DISABLED' | 'OMIT';
    /**
     * If not allowed, present transition anyway, as disabled,
     * and include this string explaining why.
     */
    disabledReason?: string;
  }>;
}
