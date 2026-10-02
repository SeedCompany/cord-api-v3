import { InputType } from '@nestjs/graphql';
import { type ID, IdField } from '~/common';
import { ExecuteTransition } from '../../../workflow/dto';
import { GtlReportStatus } from '../../dto';

@InputType()
export abstract class ExecuteGtlReportTransition extends ExecuteTransition(
  GtlReportStatus,
) {
  @IdField({
    description: 'The GTL report ID to transition',
  })
  readonly report: ID;
}
