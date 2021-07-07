import { ServerException } from '../../../common';

export type CypherExpression = string & {
  /**
   * Alias this expression as the given name.
   */
  as: (output: string) => string;
};

export const exp = (exp: string): CypherExpression =>
  new Proxy<any>(
    {},
    {
      get(target: never, p: PropertyKey): any {
        if (p === 'as') {
          return (output: string) => `${exp} as ${output}`;
        }
        if (
          p === Symbol.toPrimitive ||
          p === Symbol.toStringTag ||
          p === 'toString'
        ) {
          return () => exp;
        }
        throw new ServerException('Something went wrong');
      },
    }
  );
