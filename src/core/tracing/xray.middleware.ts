import { Injectable, NestMiddleware } from '@nestjs/common';
import * as XRay from 'aws-xray-sdk-core';
import { Request, Response } from 'express';
import { TracingService } from './tracing.service';

@Injectable()
export class XRayMiddleware implements NestMiddleware {
  constructor(private readonly tracing: TracingService) {}

  use(req: Request, res: Response, next: () => void) {
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
  }
}
