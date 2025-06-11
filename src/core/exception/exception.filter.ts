import {
  type ArgumentsHost,
  Catch,
  HttpStatus,
  type ExceptionFilter as IExceptionFilter,
  Injectable,
} from '@nestjs/common';
import { mapValues } from '@seedcompany/common';
import { HttpAdapter } from '~/core/http';
import { ConfigService } from '../config/config.service';
import { ILogger, Logger, LogLevel } from '../logger';
import { ValidationException } from '../validation';
import {
  type ExceptionJson,
  ExceptionNormalizer,
  NormalizedException,
} from './exception.normalizer';
import { isFromHackAttempt } from './is-from-hack-attempt';

@Catch()
@Injectable()
export class ExceptionFilter implements IExceptionFilter {
  constructor(
    private readonly http: HttpAdapter,
    @Logger('nest') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly normalizer: ExceptionNormalizer,
  ) {}

  async catch(exception: Error, args: ArgumentsHost) {
    // Ignore aborted requests
    if (
      (exception as any).code === 'ECONNRESET' ||
      // There is some false positive with @fastify/compress and aborted requests
      (exception as any).code === 'ERR_STREAM_PREMATURE_CLOSE'
    ) {
      if (process.env.NODE_ENV !== 'production') {
        this.logger.warning('Request aborted');
      }
      return;
    }

    const hack = isFromHackAttempt(exception, args);
    if (hack) {
      hack.raw.destroy();
      this.http.end(args.switchToHttp().getResponse());
      return;
    }

    let normalized: ExceptionJson;
    try {
      normalized = this.normalizer.normalize({ ex: exception, context: args });
    } catch (e) {
      this.logger.error(`Failed to normalize exception`, { exception: e });
      throw exception;
    }

    this.logIt(normalized, exception);

    if (args.getType() === 'graphql') {
      // re-throw our result so that the GraphQL Server picks it up
      throw new NormalizedException(normalized);
    }

    await this.respondToHttp(normalized, args);
  }

  private async respondToHttp(ex: ExceptionJson, args: ArgumentsHost) {
    const { codes } = ex;
    const status = codes.has('NotFound')
      ? HttpStatus.NOT_FOUND
      : codes.has('Unauthenticated')
      ? HttpStatus.UNAUTHORIZED
      : codes.has('Unauthorized')
      ? HttpStatus.FORBIDDEN
      : codes.has('Client')
      ? HttpStatus.BAD_REQUEST
      : codes.has('Transient')
      ? HttpStatus.SERVICE_UNAVAILABLE
      : codes.has('NotImplemented')
      ? HttpStatus.NOT_IMPLEMENTED
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const out = {
      ...ex,
      stack: process.env.NODE_ENV === 'production' ? undefined : ex.stack.split('\n'),
    };

    const res = args.switchToHttp().getResponse();
    await this.http.reply(res, out, status);
  }

  logIt(info: ExceptionJson, error: Error) {
    if ('logProps' in error && error.logProps) {
      // Assume these have already been logged.
      return;
    }
    if (this.config.jest) {
      // Jest will log exceptions, don't duplicate.
      return;
    }

    if (info.codes.has('Validation')) {
      const inputErrors =
        error instanceof ValidationException
          ? mapValues(error.errors, (_, constraints) => {
              return Object.values(constraints)[0];
            }).asRecord
          : undefined;
      this.logger.notice(info.message, {
        ...(inputErrors ? { inputErrors } : {}),
      });
      return;
    }

    const level = info.codes.has('Client') ? LogLevel.WARNING : LogLevel.ERROR;
    this.logger.log(level, info.message, {
      exception: error,
    });
  }
}
