import { Injectable } from '@nestjs/common';
import { cleanJoin, type Nil, nonEnumerable } from '@seedcompany/common';
import got, {
  type BeforeRequestHook,
  type ExtendOptions,
  type Got,
  RequestError,
  type Response,
  TimeoutError,
} from 'got';
import { type FormattedExecutionResult } from 'graphql';
import { createHmac } from 'node:crypto';
import { ConfigService } from '~/core/config/config.service';
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
        'user-agent': `cord webhook`,
      },
    } satisfies ExtendOptions);
  }

  // TODO use job queue to decouple flight attempts & retries
  async push({ webhook, payload, trigger }: WebhookExecution) {
    const body = {
      ...payload,
      extensions: {
        ...payload.extensions,
        webhook: {
          id: webhook.id,
          key: webhook.key,
          trigger,
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
