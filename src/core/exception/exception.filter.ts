import { ArgumentsHost, Catch, HttpStatus, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExceptionFilter } from '@nestjs/graphql';
import { mapValues } from '@seedcompany/common';
import { HttpAdapterHost } from '~/core/http';
import { ConfigService } from '../config/config.service';
import { ILogger, Logger, LogLevel } from '../logger';
import { ValidationException } from '../validation';
import { ExceptionJson, ExceptionNormalizer } from './exception.normalizer';
import { isFromHackAttempt } from './is-from-hack-attempt';

@Catch()
@Injectable()
export class ExceptionFilter implements GqlExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    @Logger('nest') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly normalizer: ExceptionNormalizer,
  ) {}

  catch(exception: Error, args: ArgumentsHost) {
    if (exception && (exception as any).type === 'request.aborted') {
      this.logger.warning('Request aborted');
      return;
    }

    const hack = isFromHackAttempt(exception, args);
    if (hack) {
      hack.destroy();
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

    if (args.getType<GqlContextType>() === 'graphql') {
      this.respondToGraphQL(normalized, args);
    }
    this.respondToHttp(normalized, args);
  }

  private respondToGraphQL(ex: ExceptionJson, _args: ArgumentsHost) {
    const { message, stack, ...extensions } = ex;
    const out = { message, stack, extensions };
    // re-throw our result so that Apollo Server picks it up
    throw Object.assign(new Error(), out);
  }

  private respondToHttp(ex: ExceptionJson, args: ArgumentsHost) {
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
      stack:
        process.env.NODE_ENV === 'production'
          ? undefined
          : ex.stack.split('\n'),
    };

    const { httpAdapter } = this.httpAdapterHost;
    const res = args.switchToHttp().getResponse();
    httpAdapter.reply(res, out, status);
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
    if (info.code === 'PersistedQueryNotFound') {
      // This is the normal flow. Tells the client to send full operation to be cached.
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
