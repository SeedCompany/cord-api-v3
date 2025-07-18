import { customAlphabet } from 'nanoid';
import { type ID } from './id-field';

// 100 IDs / hour = 1k years to have 1% probability of a single collision
// https://zelark.github.io/nano-id-cc/
const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const size = 11;

export const generateId: <TID extends ID = ID>() => Promise<TID> =
  customAlphabet(alphabet, size) as any;

export const isValidId = (value: unknown): value is ID => {
  if (typeof value !== 'string') {
    return false;
  }
  return /^[0-9a-zA-Z_-]+$/.test(value);
};
