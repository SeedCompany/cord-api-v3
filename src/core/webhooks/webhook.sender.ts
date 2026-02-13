import { Injectable } from '@nestjs/common';
import { cleanJoin, type Nil, nonEnumerable } from '@seedcompany/common';
import { stripIndent } from 'common-tags';
import got, {
  type BeforeRequestHook,
  type ExtendOptions,
  type Got,
  HTTPError,
  ParseError,
  RequestError,
  type Response,
  TimeoutError,
} from 'got';
import { type FormattedExecutionResult } from 'graphql';
import { createHmac, randomBytes } from 'node:crypto';
import { InputException } from '~/common';
import { ConfigService } from '~/core/config';
import { ILogger, Logger, LogLevel } from '../logger';
import { type Webhook as FullWebhook, type WebhookTrigger } from './dto';

// Strip out large, unneeded properties to save on storage in a future queue.
type Webhook = Omit<
  FullWebhook,
  'subscription' | 'variables' | 'channels' | 'createdAt' | 'modifiedAt'
>;

export interface WebhookExecution {
  webhook: Webhook;
  payload: FormattedExecutionResult;
  trigger: WebhookTrigger;
  fatal: boolean; // whether this is the last event the hook will receive, due to it being invalid.
}

/**
 * Creates HTTP POST requests for the appropriate webhooks.
 */
@Injectable()
export class WebhookSender {
  private readonly http: Got;

  constructor(
    config: ConfigService,
    @Logger('webhooks') private readonly logger: ILogger,
  ) {
    this.http = got.extend({
      throwHttpErrors: false,
      timeout: {
        request: config.webhooks.requestTimeout.toMillis(),
      },
      headers: {
        'user-agent': 'cord webhook',
      },
    } satisfies ExtendOptions);
  }

  async verify(webhook: Webhook, challenge?: string) {
    challenge ??= randomBytes(32).toString('hex');

    const logCtx = {
      name: webhook.name,
      id: webhook.id,
      url: webhook.url,
      owner: webhook.owner.id,
    };

    const body = { challenge };
    try {
      const payload = await this.http
        .post(webhook.url, {
          json: body,
          throwHttpErrors: true,
          hooks: {
            // This is not strictly necessary as it we don't send any data
            // that should be acted upon.
            // But this does allow the consumer to blindly verify the request
            // before splitting their logic based on the challenge vs. event.
            beforeRequest: [this.signRequest(webhook)],
          },
        })
        .json<typeof body>();
      if (payload.challenge !== challenge) {
        // noinspection ExceptionCaughtLocallyJS
        throw new InputException(
          'The endpoint must echo back the challenge request.',
        );
      } else {
        this.logger.info('Webhook challenge verified', logCtx);
      }
    } catch (error) {
      let reason = 'unknown error';
      let cause: RequestError | undefined = undefined;
      if (error instanceof InputException) {
        reason = error.message;
      } else if (error instanceof RequestError) {
        if (error.code === 'ECONNREFUSED') {
          reason = 'Connection refused';
        } else if (error instanceof TimeoutError) {
          reason = 'Request timed out';
        } else if (error instanceof HTTPError) {
          reason = 'Response did not have a successful status code';
        } else if (error instanceof ParseError) {
          reason = 'Response was not valid JSON';
          cause = error;
        } else {
          cause = error;
        }
      }

      if (cause) {
        // suppress log spam
        nonEnumerable(
          cause,
          ...(cause.input ? [] : ['input']),
          'options',
          'request',
          'timings',
        );
      }

      this.logger.warning('Webhook challenge verification failed', {
        ...logCtx,
        reason,
        exception: cause,
      });
      throw new InputException(
        stripIndent`
          Webhook challenge verification failed.
          Reason: ${reason}
        `,
        'url',
        cause,
      );
    }
  }

  // TODO use job queue to decouple flight attempts & retries
  async push({ webhook, payload, trigger, fatal }: WebhookExecution) {
    const body = {
      ...payload,
      extensions: {
        ...payload.extensions,
        webhook: {
          id: webhook.id,
          key: webhook.key,
          trigger,
          valid: !fatal,
          // attempt: 1,
        },
        userMetadata: webhook.metadata,
      },
    };

    let response: Response<string> | undefined;
    // connection errors
    let error: Error | Nil;
    try {
      response = await this.http.post(webhook.url, {
        json: body,
        hooks: {
          // Add the signature header in hook so timing is recalculated on retries.
          beforeRequest: [this.signRequest(webhook)],
        },
      });
    } catch (e) {
      error = e;
    }

    const logExtra: { reason?: string; [x: string]: unknown } = {};
    if (error && error instanceof RequestError) {
      if (error.code === 'ECONNREFUSED') {
        error = null;
        logExtra.reason = 'Connection refused';
      } else if (error instanceof TimeoutError) {
        error = null;
        logExtra.reason = 'Request timed out';
      } else {
        nonEnumerable(
          error,
          ...(error.input ? [] : ['input']),
          'options',
          'request',
          'timings',
        );
      }
    } else if (response && response.statusCode >= 400) {
      logExtra.reason = cleanJoin(': ', [
        response.statusCode,
        response.statusMessage,
      ]);
      let body = response.body;
      try {
        body = JSON.parse(body);
      } catch {
        /**/
      }
      logExtra.response = body;
    }

    const success = response && response.statusCode < 400;
    this.logger.log({
      level: success ? LogLevel.INFO : LogLevel.WARNING,
      message: success
        ? 'Webhook sent successfully'
        : 'Webhook response was not successful',
      name: webhook.name,
      id: webhook.id,
      url: webhook.url,
      owner: webhook.owner.id,
      ...(error ? { exception: error } : {}),
      ...logExtra,
    });
  }

  private signRequest(webhook: Webhook): BeforeRequestHook {
    return (options) => {
      options.headers['cord-signature'] = this.computeSignatureHeader(
        options.body as string,
        webhook.secret,
      );
    };
  }

  private computeSignatureHeader(body: string, secret: string) {
    const timestamp = Math.floor(Date.now() / 1000);
    const scheme = 'v1';
    const signature = this.computeSignature(`${timestamp}.${body}`, secret);
    const header = `t=${timestamp},${scheme}=${signature}`;
    return header;
  }

  private computeSignature(payload: string, secret: string) {
    return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
  }
}
