import { GelError } from 'gel';

declare module 'gel' {
  interface GelError {
    /**
     * A formatted hex representation of the code.
     * This is expected to be called directly by dev when debugging.
     * Since `code` is formatted in base 10, it can't be matched mentally.
     * @example "0x_FF_02_00_00"
     */
    codeAsHex: string | null;
  }
}

Object.defineProperty(GelError.prototype, 'codeAsHex', {
  configurable: true,
  get() {
    if (this.code == null) {
      return null;
    }
    const hex: string = this.code.toString(16).padStart(8, '0');
    return `0x${hex}`.match(/.{2}/g)!.join('_');
  },
});
