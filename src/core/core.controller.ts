import { Controller, Get, HttpStatus, Redirect } from '@nestjs/common';
import { ConfigService } from './config/config.service';

@Controller()
export class CoreController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  welcome() {
    // Welcome info but mostly for health checks
    return 'Welcome to CORD! Use /graphql to access our GraphQL API.';
  }

  @Get('favicon.ico')
  @Redirect('', HttpStatus.FOUND)
  favicon() {
    return {
      url: this.config.frontendUrl + '/favicon.ico',
    };
  }
}
