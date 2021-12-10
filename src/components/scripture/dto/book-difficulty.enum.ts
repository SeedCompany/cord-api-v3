import { registerEnumType } from '@nestjs/graphql';

export enum BookDifficulty {
  Easy = 'Easy',
  Normal = 'Normal',
  Hard = 'Hard',
  Hardest = 'Hardest',
}

registerEnumType(BookDifficulty, {
  name: 'BookDifficulty',
  description: 'How hard is this book to translate?',
});
