import { Controller, Get, Header, StreamableFile } from '@nestjs/common';
import { createReadStream } from 'node:fs';
import { join } from 'node:path';
import process from 'node:process';
import { AuthLevel } from '~/core/authentication';

@Controller()
@AuthLevel(AuthLevel.Sessionless)
export class CoreController {
  @Get()
  welcome() {
    // Welcome info but mostly for health checks
    return 'Welcome to CORD! Use /graphql to access our GraphQL API.';
  }

  @Get('favicon.ico')
  @Header('cache-control', `public, max-age=${2.628e6}, immutable`)
  favicon() {
    const icon = createReadStream(join(process.cwd(), './icon.svg'));
    return new StreamableFile(icon, {
      type: 'image/svg+xml',
    });
  }
}
