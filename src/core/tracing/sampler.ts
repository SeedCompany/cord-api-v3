import { type ExecutionContext } from '@nestjs/common';
import { type Segment } from './tracing.service';

export abstract class Sampler {
  /**
   * Should this execution be traced?
   *
   * Returns a boolean or a specific rule name indicating why true.
   */
  abstract shouldTrace(
    context: ExecutionContext,
    segment: Segment,
  ): Promise<string | boolean>;
}
