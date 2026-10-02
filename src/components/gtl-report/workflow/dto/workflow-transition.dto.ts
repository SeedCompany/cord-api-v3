import { ObjectType } from '@nestjs/graphql';
import { WorkflowTransition } from '../../../workflow/dto';
import { GtlReportStatus } from '../../dto';

@ObjectType({
  description: WorkflowTransition.descriptionFor('GTL report'),
})
export abstract class GtlReportWorkflowTransition extends WorkflowTransition(
  GtlReportStatus,
) {}
