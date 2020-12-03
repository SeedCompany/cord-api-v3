import { Injectable } from '@nestjs/common';
import fetch from 'node-fetch';
import { ConfigService } from '../../config/config.service';

@Injectable()
export class DbV4 {
  constructor(private readonly config: ConfigService) {}

  async post<ResponseType>(path: string, obj: Record<string, any>) {
    const data = JSON.stringify(obj);
    const response = await fetch(this.config.dbLocalUrl.url + path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: data,
    });
    return (await response.json()) as ResponseType;
  }
}
