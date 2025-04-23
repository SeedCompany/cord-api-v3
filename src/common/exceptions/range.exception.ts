import { InputException } from '~/common';

export class RangeException extends InputException {
  constructor(options?: { message?: string; field?: string; cause?: Error }) {
    super(options?.message ?? `Invalid range`, options?.field, options?.cause);
  }
}
