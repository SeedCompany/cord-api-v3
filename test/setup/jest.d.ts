import type { AsymmetricMatcher } from 'expect';

declare module 'expect' {
  interface AsymmetricMatchers {
    // Fix this method mistakenly requiring a mutable array
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    arrayContaining(err: readonly unknown[]): AsymmetricMatcher;
  }
}
