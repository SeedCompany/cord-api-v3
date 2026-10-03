import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportOtherActivities as OtherActivities } from '../dto/other-activities.dto';

@Injectable()
export class ProgressReportOtherActivitiesRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'otherActivities'],
  OtherActivities,
) {}
