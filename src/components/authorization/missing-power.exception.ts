import { UnauthorizedException } from '~/common';
import { Power } from './dto';

export class MissingPowerException extends UnauthorizedException {
  constructor(
    readonly power: Power,
    message = `Missing required power: ${power}`,
    previous?: Error,
  ) {
    super(message, previous);
  }
}
