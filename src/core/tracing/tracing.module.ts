import {
  MiddlewareConsumer,
  Module,
  NestModule,
  OnModuleInit,
} from '@nestjs/common';
import * as XRay from 'aws-xray-sdk-core';
import { Request, Response } from 'express';
import { ConfigService } from '../config/config.service';
import { VersionService } from '../config/version.service';
import { ILogger, Logger, LoggerModule, LogLevel } from '../logger';
import { TracingService } from './tracing.service';

@Module({
  imports: [LoggerModule],
  providers: [TracingService],
  exports: [TracingService],
})
export class TracingModule implements OnModuleInit, NestModule {
  constructor(
    @Logger('xray') private readonly logger: ILogger,
    private readonly tracing: TracingService,
    private readonly config: ConfigService,
    private readonly version: VersionService
  ) {}

  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply((req: Request, res: Response, next: () => void) => {
        const traceData = XRay.utils.processTraceData(
          req.header('x-amzn-trace-id')
        );
        const root = new XRay.Segment('cord', traceData.root, traceData.parent);
        const reqData = new XRay.middleware.IncomingRequestData(req);
        root.addIncomingRequestData(reqData);

        res.setHeader('x-amzn-trace-id', `Root=${root.trace_id};Sampled=1`);

        res.on('finish', () => {
          const status = res.statusCode.toString();
          if (status.startsWith('4')) {
            root.addErrorFlag();
          } else if (status.startsWith('5')) {
            root.addFaultFlag();
          } else if (res.statusCode === 429) {
            root.addThrottleFlag();
          }

          // @ts-expect-error xray library types suck
          root.http.close(res);
          root.close();
          root.flush();
        });

        this.tracing.segmentStorage.run(root, next);
      })
      .forRoutes('*');
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
