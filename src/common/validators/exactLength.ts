import { Length } from 'class-validator';

export const ExactLength = (length: number) =>
  Length(length, length, {
    message: `Must be exactly ${length} characters long`,
  });
