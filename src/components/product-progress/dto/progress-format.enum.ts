import { stripIndent } from 'common-tags';
import { EnumType, makeEnum } from '~/common';

export type ProgressFormat = EnumType<typeof ProgressFormat>;
export const ProgressFormat = makeEnum({
  name: 'ProgressFormat',
  description: 'A format for a progress number',
  values: [
    {
      value: 'Numerator',
      description: stripIndent`
        The raw value that does not take into account the target value.
        This will be 0 <= # <= the product's \`progressTarget\` number.
        For example, # of Y complete
      `,
    },
    {
      value: 'Decimal',
      description: stripIndent`
        A percent expressed as a decimal (0-1)
        For example, 0.# * 100 percent complete
      `,
    },
    {
      value: 'Percent',
      description: stripIndent`
        A percent which already has already been multiplied by 100
        For example, ##.#% complete
      `,
    },
    {
      value: 'Verses',
      description: stripIndent`
        The number of verses completed
      `,
    },
    {
      value: 'VerseEquivalents',
      description: stripIndent`
        The number of verse equivalents completed
      `,
    },
  ],
});
