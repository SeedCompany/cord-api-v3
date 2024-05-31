import { Promisable } from 'type-fest';

export interface DynamicState<State extends string, Params> {
  description: string;
  resolve: (params: Params) => Promisable<State>;
}
