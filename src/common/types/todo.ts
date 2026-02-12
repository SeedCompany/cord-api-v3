import { NotImplementedException } from '~/common/exceptions';

function TODOFn(..._args: any[]) {
  throw new NotImplementedException();
}
export const TODO = TODOFn as any;
// eslint-disable-next-line @seedcompany/no-unused-vars
export type TODO<A = any, B = any, C = any, D = any> = any;
