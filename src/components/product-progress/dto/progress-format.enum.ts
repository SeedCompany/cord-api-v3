import { registerEnumType } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';

export enum ProgressFormat {
  Numerator = 'Numerator',
  Decimal = 'Decimal',
  Percent = 'Percent',
  Verses = 'Verses',
  VerseEquivalents = 'VerseEquivalents',
}

registerEnumType(ProgressFormat, {
  name: 'ProgressFormat',
  description: 'A format for a progress number',
  valuesMap: {
    Numerator: {
      description: stripIndent`
        The raw value that does not take into account the target value.
        This will be 0 <= # <= the product's \`progressTarget\` number.
        For example, # of Y complete
      `,
    },
    Decimal: {
      description: stripIndent`
        A percent expressed as a decimal (0-1)
        For example, 0.# * 100 percent complete
      `,
    },
    Percent: {
      description: stripIndent`
        A percent which already has already been multiplied by 100
        For example, ##.#% complete
      `,
    },
    Verses: {
      description: stripIndent`
        The number of verses completed
      `,
    },
    VerseEquivalents: {
      description: stripIndent`
        The number of verse equivalents completed
      `,
    },
  },
});
