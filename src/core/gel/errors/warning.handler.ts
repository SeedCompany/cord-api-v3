import { Injectable } from '@nestjs/common';
import { GelError } from 'gel';
import { ILogger, Logger } from '~/core/logger';
import { cleanError } from './index';

@Injectable()
export class GelWarningHandler {
  constructor(@Logger('Gel') private readonly logger: ILogger) {}

  handle(warnings: GelError[]) {
    for (const warning of warnings) {
      cleanError(warning);
      this.logger.warning({
        message: warning.message,
        exception: warning,
      });
    }
  }
}
