import { Injectable } from '@nestjs/common';
import { PromptVariantResponseDrizzleRepository } from '../../prompts/prompt-variant-response.drizzle.repository';
import { GTLReport, GtlReportPraise } from '../dto';

@Injectable()
export class GtlReportPraiseDrizzleRepository extends PromptVariantResponseDrizzleRepository(
  [GTLReport, 'praises'],
  GtlReportPraise,
) {}
