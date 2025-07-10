import { Injectable } from '@nestjs/common';
import { type EmailModuleOptions } from '@seedcompany/nestjs-email';
import { ConfigService } from '~/core/config/config.service';

@Injectable()
export class EmailConfig {
  constructor(private readonly config: ConfigService) {}

  create(): EmailModuleOptions {
    const options = this.config.emailDriver;
    return options;
  }
}
