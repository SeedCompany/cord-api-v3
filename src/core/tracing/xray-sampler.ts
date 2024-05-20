import { ExecutionContext, Injectable } from '@nestjs/common';
import {
  GqlExecutionContext,
  GqlContextType as GqlExeType,
} from '@nestjs/graphql';
import XRay from 'aws-xray-sdk-core';
import { GqlContextType } from '~/common';
import { Sampler } from './sampler';
import { Segment } from './tracing.service';

/**
 * Sampling provided by X-Ray library/service.
 */
@Injectable()
export class XraySampler implements Sampler {
  async shouldTrace(context: ExecutionContext, segment: Segment) {
    // Pretty specific to configuration outside of this module...
    const req =
      context.getType<GqlExeType>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext<GqlContextType>()
            .request
        : context.switchToHttp().getRequest();

    // eslint-disable-next-line @typescript-eslint/ban-types
    const rule: String | string | boolean | null | undefined =
      // @ts-expect-error not typed but it exists
      XRay.middleware.sampler.shouldSample({
        host: req.headers.host,
        httpMethod: req.method,
        urlPath: req.url,
        serviceName: segment.name,
      });

    // Including this because lib checks for it so normalizing to be safe.
    // https://github.com/aws/aws-xray-sdk-node/blob/a9d0cf9/packages/core/lib/middleware/mw_utils.js#L103
    // Also doing falsy check here to further narrow output type
    return rule instanceof String ? rule.toString() : rule || false;
  }
}
