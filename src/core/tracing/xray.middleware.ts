import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import XRay from 'aws-xray-sdk-core';
import { type GlobalHttpHook, HttpAdapter } from '~/core/http';
import { ConfigService } from '../config/config.service';
import { Sampler } from './sampler';
import { TracingService } from './tracing.service';

@Injectable()
export class XRayMiddleware implements NestInterceptor {
  constructor(
    private readonly tracing: TracingService,
    private readonly sampler: Sampler,
    private readonly config: ConfigService,
    private readonly http: HttpAdapter,
  ) {}

  /**
   * Setup root segment for request/response.
   */
  // @GlobalHttpHook() // disabled, xray tracing not really helping us.
  onRequest(...[req, res, next]: Parameters<GlobalHttpHook>) {
    const traceData = XRay.utils.processTraceData(
      req.headers['x-amzn-trace-id'] as string | undefined,
    );
    const root = new XRay.Segment('cord', traceData.root, traceData.parent);
    const reqData = new XRay.middleware.IncomingRequestData(req.raw);
    root.addIncomingRequestData(reqData);
    // Use public DNS as url instead of specific IP
    // @ts-expect-error xray library types suck
    root.http.request.url = this.config.hostUrl$.value + req.url.slice(1);

    // Add to segment so interceptor can access without having to calculate again.
    Object.defineProperty(reqData, 'traceData', {
      value: traceData,
      enumerable: false,
    });

    res.raw.on('finish', () => {
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

  /**
   * Determine if segment should be traced/sampled.
   * This is done in an interceptor so that the sampler can use the built
   * ExecutionContext instead of a raw request. For example, GraphQL execution
   * context has much richer info than the raw request.
   */
  async intercept(context: ExecutionContext, next: CallHandler) {
    let rootSegment;
    try {
      rootSegment = this.tracing.rootSegment;
    } catch (e) {
      return next.handle();
    }

    const root = rootSegment as unknown as XRay.Segment | XRay.Subsegment;
    // @ts-expect-error we added it in middleware, so we don't have to parse it again
    // Don't assume though, i.e. tests don't run through middleware above.
    const sampledHeader: '1' | '0' | '?' = root.http?.traceData?.sampled ?? '?';

    let sampled: string | boolean | undefined =
      sampledHeader === '1' ? true : sampledHeader === '0' ? false : undefined;

    // If no explicit address, disable tracing.
    // Otherwise traces will be buffered leading to memory leak
    if (!this.config.xray.daemonAddress) {
      sampled = false;
    }

    if (sampled == null) {
      sampled = await this.sampler.shouldTrace(context, rootSegment);
    }

    if (typeof sampled === 'string' && root instanceof XRay.Segment) {
      root.setMatchedSamplingRule(sampled);
    }

    // Pretty specific to configuration outside of this module...
    const res =
      context.getType() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().response
        : context.switchToHttp().getResponse();

    if (res && root instanceof XRay.Segment) {
      this.http.setHeader(
        res,
        'x-amzn-trace-id',
        `Root=${root.trace_id};Sampled=${sampled ? '1' : '0'}`,
      );
    }

    if (!sampled && root instanceof XRay.Segment) {
      root.notTraced = true;
    }

    return next.handle();
  }
}
