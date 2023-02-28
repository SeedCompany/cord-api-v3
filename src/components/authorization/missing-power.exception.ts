import { UnauthorizedException } from '../../common/exceptions';
import { Powers } from './dto/powers';

export class MissingPowerException extends UnauthorizedException {
  constructor(
    readonly power: Powers,
    message = `Missing required power: ${power}`,
    previous?: Error,
  ) {
    super(message, previous);
  }
}
