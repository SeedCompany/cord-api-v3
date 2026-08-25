import { Injectable } from '@nestjs/common';
import { PromptVariantResponseDrizzleRepository } from '../../prompts/prompt-variant-response.drizzle.repository';
import { GTLReport, GtlReportPetition } from '../dto';

@Injectable()
export class GtlReportPetitionDrizzleRepository extends PromptVariantResponseDrizzleRepository(
  [GTLReport, 'petitions'],
  GtlReportPetition,
) {}
