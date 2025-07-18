import { Module, type OnModuleInit } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import XRay from 'aws-xray-sdk-core';
import * as process from 'node:process';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { ILogger, Logger, LoggerModule, LogLevel } from '../logger';
import { Sampler } from './sampler';
import { TracingService } from './tracing.service';
import { XraySampler } from './xray-sampler';
import { XRayMiddleware } from './xray.middleware';

@Module({
  imports: [LoggerModule],
  providers: [
    TracingService,
    { provide: Sampler, useClass: XraySampler },
    XRayMiddleware,
    { provide: APP_INTERCEPTOR, useExisting: XRayMiddleware },
  ],
  exports: [TracingService],
})
export class TracingModule implements OnModuleInit {
  constructor(
    @Logger('xray') private readonly logger: ILogger,
    private readonly config: ConfigService,
    private readonly version: VersionService,
  ) {}

  async onModuleInit() {
    // Don't use cls-hooked lib. It's old and Node has AsyncLocalStorage now.
    XRay.enableManualMode();

    // XR.setStreamingThreshold(50); // default 100

    XRay.config([XRay.plugins.ECSPlugin]);

    if (process.env.NODE_ENV !== 'production') {
      XRay.middleware.disableCentralizedSampling();
    }

    const version = await this.version.version;
    this.config.hostUrl$.subscribe((hostUrl) => {
      XRay.SegmentUtils.setServiceData({
        name: hostUrl.toString(),
        version: version.toString(),
        runtime: process.release.name,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        runtime_version: process.version,
      });
    });

    if (this.config.xray.daemonAddress) {
      XRay.setDaemonAddress(this.config.xray.daemonAddress);
    }

    const log =
      (level: LogLevel): XRay.Logger[keyof XRay.Logger] =>
      (msg: string, err: Error | string) => {
        if (err instanceof Error) {
          this.logger.log(level, msg, { exception: err });
          return;
        }
        if (msg.startsWith('Segment too large to send')) {
          const matches = msg.match(
            /Segment too large to send: (\{.+}) \((\d+) bytes\)./,
          );
          try {
            this.logger.warning(
              'Segment too large to send',
              matches
                ? {
                    ...JSON.parse(
                      matches[1]!.replace('"trace_id:"', '"trace_id":"'),
                    ),
                    size: matches[2]!,
                  }
                : undefined,
            );
            return;
          } catch {
            // fallthrough
          }
        }
        this.logger.log(level, err ? `${msg} ${err}` : msg);
      };
    XRay.setLogger({
      info: log(LogLevel.INFO),
      debug: log(LogLevel.DEBUG),
      error: log(LogLevel.ERROR),
      warn: log(LogLevel.WARNING),
    });
  }
}
