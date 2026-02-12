import { cleanSplit, setOf } from '@seedcompany/common';
import { createMetadataDecorator } from '@seedcompany/nest';

export const DbLabel = createMetadataDecorator({
  types: ['class', 'property'],
  setter: (...labels: string[] | [null]) =>
    setOf(labels.flatMap((label) => cleanSplit(label ?? '', ':'))),
  merge: ({ previous, next }) => previous?.union(next) ?? next,
});
