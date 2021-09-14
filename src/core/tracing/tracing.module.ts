import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import * as XRay from 'aws-xray-sdk-core';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { ILogger, Logger, LoggerModule, LogLevel } from '../logger';
import { TracingService } from './tracing.service';
import { XRayMiddleware } from './xray.middleware';

@Module({
  imports: [LoggerModule],
  providers: [TracingService, XRayMiddleware],
  exports: [TracingService],
})
export class TracingModule implements OnModuleInit, NestModule {
  constructor(
    @Logger('xray') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly version: VersionService
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer.apply(XRayMiddleware).forRoutes('*');
  }

  async onModuleInit() {
    // Don't use cls-hooked lib. It's old and Node has AsyncLocalStorage now.
    XRay.enableManualMode();

    // XR.setStreamingThreshold(50); // default 100

    XRay.config([XRay.plugins.ECSPlugin]);

    XRay.SegmentUtils.setServiceData({
      name: this.config.hostUrl,
      version: (await this.version.version).toString(),
      runtime: process.release?.name ?? 'unknown',
      // eslint-disable-next-line @typescript-eslint/naming-convention
      runtime_version: process.version,
    });

    const log =
      (level: LogLevel): XRay.Logger[keyof XRay.Logger] =>
      (msg: string, err: Error | string) => {
        if (err instanceof Error) {
          this.logger.log(level, msg, { exception: err });
        } else {
          this.logger.log(level, err ? `${msg} ${err}` : msg);
        }
      };
    XRay.setLogger({
      info: log(LogLevel.INFO),
      debug: log(LogLevel.DEBUG),
      error: log(LogLevel.ERROR),
      warn: log(LogLevel.WARNING),
    });
  }
}
