declare namespace jest {
  interface Expect {
    // Fix this method mistakenly requiring a mutable array
    // eslint-disable-next-line @typescript-eslint/method-signature-style
    arrayContaining<E = any>(err: readonly E[]): any;
  }
}
