import { Injectable } from '@nestjs/common';
import got, { type ExtendOptions, type Got } from 'got';
import { ConfigService } from '~/core/config';

@Injectable()
export class SeedApiService {
  private readonly http: Got;

  constructor(config: ConfigService) {
    this.http = got.extend({
      prefixUrl: config.seedApi.url,
      headers: {
        'user-agent': 'cord-api',
        authorization: config.seedApi.secret,
      },
    } satisfies ExtendOptions);
  }

  async query<T>(
    document: string,
    variables?: Record<string, unknown>,
  ): Promise<T | null> {
    const response = await this.http
      .post('graphql', { json: { query: document, variables } })
      .json<{ data: T | null }>();
    return response.data;
  }
}
