import { EnumType, makeEnum } from '~/common';

export type BookDifficulty = EnumType<typeof BookDifficulty>;
export const BookDifficulty = makeEnum({
  name: 'BookDifficulty',
  description: 'How hard is this book to translate?',
  values: ['Easy', 'Normal', 'Hard', 'Hardest'],
});
