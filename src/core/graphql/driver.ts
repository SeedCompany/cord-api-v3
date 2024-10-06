import { YogaDriver, YogaDriverConfig } from '@graphql-yoga/nestjs';
import { Injectable } from '@nestjs/common';
import { HttpAdapter } from '../http';

@Injectable()
export class Driver extends YogaDriver<'fastify'> {
  constructor(private readonly http: HttpAdapter) {
    super();
  }

  async start(options: YogaDriverConfig<'fastify'>) {
    await super.start(options);

    // Setup file upload handling
    const fastify = this.http.getInstance();
    fastify.addContentTypeParser('multipart/form-data', (req, payload, done) =>
      done(null),
    );
  }
}
