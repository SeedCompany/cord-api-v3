import { UnauthorizedException } from '~/common';
import { type Power } from './dto';

export class MissingPowerException extends UnauthorizedException {
  constructor(
    readonly power: Power,
    message = `Missing required power: ${power}`,
    previous?: Error,
  ) {
    super(message, previous);
  }
}
