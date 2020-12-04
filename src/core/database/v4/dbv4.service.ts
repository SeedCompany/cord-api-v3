import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { ConfigService } from '../../config/config.service';
import { ILogger, Logger } from '../../logger';

@Injectable()
export class DbV4 {
  constructor(
    private readonly config: ConfigService,
    @Logger('dbv4:service') private readonly logger: ILogger
  ) {}

  async post<ResponseType>(path: string, obj: Record<string, any>) {
    this.logger.debug('sending: ', { path, obj });
    const data = JSON.stringify(obj);
    const response = await fetch(this.config.dbLocalUrl.url + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: data,
    });
    const json = await response.json();
    this.logger.debug('response: ', { json });
    return json as ResponseType;
  }
}
