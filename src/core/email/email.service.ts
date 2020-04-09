import { Injectable } from '@nestjs/common';
import { SES } from 'aws-sdk';
import { SendEmailRequest } from 'aws-sdk/clients/ses';
import { promises as fs } from 'fs';
import * as open from 'open';
import { file as tempFile } from 'tempy';
import { ConfigService, ILogger, Logger } from '..';
import { Many, many, maybeMany, sleep } from '../../common';

@Injectable()
export class EmailService {
  constructor(
    private readonly ses: SES,
    private readonly config: ConfigService,
    @Logger('email') private readonly logger: ILogger
  ) {}

  async send(to: Many<string>, subject: string, html: string, text: string) {
    const { from, replyTo, send, open } = this.config.email;

    const logProps = {
      to: many(to),
      subject,
    };
    this.logger.debug('Sending email', logProps);

    if (open) {
      await this.openEmail(html);
    }

    if (!send) {
      this.logger.debug('Would have sent email if enabled', {
        ...logProps,
        text,
      });
      return;
    }

    const utf8 = (data: string) => ({ Data: data, Charset: 'UTF-8' });
    const req: SendEmailRequest = {
      Source: from,
      Destination: {
        ToAddresses: many(to).slice(),
      },
      ReplyToAddresses: maybeMany(replyTo)?.slice(),
      Message: {
        Subject: utf8(subject),
        Body: { Html: utf8(html), Text: utf8(text) },
      },
    };
    try {
      await this.ses.sendEmail(req).promise();
      this.logger.info('Sent email', logProps);
    } catch (e) {
      this.logger.error('Failed to send email', { exception: e });
      throw e; // TODO What are the cases where an error is thrown and should we swallow?
    }
  }

  private async openEmail(html: string) {
    const temp = tempFile({ extension: 'html' });
    await fs.writeFile(temp, html);
    await open(`file://${temp}`);
    // try to wait for chrome to open before deleting temp file
    await sleep(1_000);
    await fs.unlink(temp);
  }
}
