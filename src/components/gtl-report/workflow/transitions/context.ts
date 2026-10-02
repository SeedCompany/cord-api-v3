import { type ModuleRef } from '@nestjs/core';
import { type MaybeSecured } from '~/common';
import { type GTLReport } from '../../dto';

/**
 * What a runtime transition condition is handed. The report may be the
 * secured or the unsecured shape depending on the caller; `moduleRef` is how a
 * condition reaches the session and the event history without the workflow
 * definition importing services.
 */
export interface ResolveParams {
  report: MaybeSecured<GTLReport>;
  moduleRef: ModuleRef;
}
