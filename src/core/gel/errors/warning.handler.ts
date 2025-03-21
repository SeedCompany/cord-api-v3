import { Injectable } from '@nestjs/common';
import { cached } from '@seedcompany/common';
import { GelError } from 'gel';
import { TraceNames } from '~/common';
import { ILogger, Logger } from '~/core/logger';
import { DbTraceLayer } from '../gel.service';
import { attributesOf, cleanError, fixWarningQuerySnippet } from './index';

@Injectable()
export class GelWarningHandler {
  constructor(@Logger('Gel') private readonly logger: ILogger) {}
  private readonly seenCache = new WeakMap<TraceNames, Set<string>>();

  handle(warnings: GelError[]) {
    const seenIdsInCtx = this.seenCacheInContext();
    for (const warning of warnings) {
      if (!this.isFirstTimeInContext(warning, seenIdsInCtx)) {
        continue;
      }

      fixWarningQuerySnippet(warning);
      cleanError(warning);
      this.logger.warning({
        message: warning.message,
        exception: warning,
      });
    }
  }

  private isFirstTimeInContext(warning: GelError, seenIds?: Set<string>) {
    if (!seenIds) {
      return true;
    }
    const warningId = this.getWarningId(warning);
    if (seenIds.has(warningId)) {
      return false;
    }
    seenIds.add(warningId);
    return true;
  }

  private getWarningId(warning: GelError) {
    // Without hint, detail, query snippet
    const message: string = (warning as any)._message;
    const attrs = attributesOf(warning);
    const line = attrs.lineStart;
    const col = attrs.columnStart ?? attrs.utf16ColumnStart;
    return `${line ?? ''}:${col ?? ''}\0${message}`;
  }

  private seenCacheInContext() {
    const trace = DbTraceLayer.currentStack?.[0];
    return trace ? cached(this.seenCache, trace, () => new Set()) : undefined;
  }
}
