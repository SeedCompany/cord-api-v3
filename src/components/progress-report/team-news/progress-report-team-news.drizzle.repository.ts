import { Injectable } from '@nestjs/common';
import { PromptVariantResponseDrizzleRepository } from '../../prompts/prompt-variant-response.drizzle.repository';
import { ProgressReport } from '../dto';
import { ProgressReportTeamNews as TeamNews } from '../dto/team-news.dto';

@Injectable()
export class ProgressReportTeamNewsDrizzleRepository extends PromptVariantResponseDrizzleRepository(
  [ProgressReport, 'teamNews'],
  TeamNews,
) {}
