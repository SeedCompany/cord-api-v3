import { EnumOptions } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';

export const exposeSrcOrder = <T extends object>(
  enumObject: T,
  valueMap?: EnumOptions<T>['valuesMap'],
) => {
  const entries = Object.keys(enumObject) as Array<keyof T>;
  return Object.fromEntries(
    entries.map((value, index) => {
      const passedIn = valueMap?.[value] ?? {};
      return [
        value,
        {
          ...passedIn,
          description: stripIndent(
            (passedIn.description ?? '') + `\n\n@order ${index}`,
          ),
        },
      ];
    }),
  );
};
