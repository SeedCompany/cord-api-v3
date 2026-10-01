import { Injectable } from '@nestjs/common';
import { PromptVariantResponseRepository } from '../../prompts/prompt-variant-response.repository';
import { ProgressReport } from '../dto';
import { ProgressReportTeamNews as TeamNews } from '../dto/team-news.dto';

@Injectable()
export class ProgressReportTeamNewsRepository extends PromptVariantResponseRepository(
  [ProgressReport, 'teamNews'],
  TeamNews,
) {}
