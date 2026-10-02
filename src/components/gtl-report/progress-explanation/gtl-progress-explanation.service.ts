import { Injectable } from '@nestjs/common';
import { type ID, InputException, NotFoundException } from '~/common';
import { ResourceLoader } from '~/core/resources';
import { Privileges } from '../../authorization';
import {
  type ExplainGtlProgress,
  GtlProgressExplanation,
  GTLReport,
} from '../dto';
import { contextOf } from '../privilege-context';
import { GtlProgressExplanationRepository } from './gtl-progress-explanation.repository';

@Injectable()
export class GtlProgressExplanationService {
  constructor(
    private readonly repo: GtlProgressExplanationRepository,
    private readonly privileges: Privileges,
    private readonly resources: ResourceLoader,
  ) {}

  /**
   * The report's explanation, secured field by field — or `null` when the
   * requester may read neither field, so the section does not exist for them
   * at all. That is the whole point of the confidentiality: the Field Partner
   * who wrote the report never learns there is something they can't see, and
   * the context text never leaves the server.
   */
  async readOne(report: GTLReport): Promise<GtlProgressExplanation | null> {
    const dto = await this.repo.readOne(report.id);
    const secured = this.privilegesFor(report).secure(dto);
    if (!secured.status.canRead && !secured.context.canRead) {
      return null;
    }
    return secured;
  }

  async explain(input: ExplainGtlProgress): Promise<GTLReport> {
    const report = await this.loadReport(input.report);
    this.privilegesFor(report).verifyCan('edit');

    // "On Track" speaks for itself; anything else needs the why.
    if (input.status !== 'OnTrack' && !input.context) {
      throw new InputException(
        'Context is required unless the internship is On Track',
        'context',
      );
    }

    await this.repo.upsert(input);
    return report;
  }

  /**
   * The report, secured — its `scope` and `sensitivity` are what the member
   * and sensitivity conditions on the explanation grants read. Progress and
   * GTL rows share one table and one loader, so a Progress report's id is
   * answered as "not found" rather than explained.
   */
  private async loadReport(id: ID): Promise<GTLReport> {
    const report = await this.resources.load(GTLReport, id);
    if (report.type !== 'GTL') {
      throw new NotFoundException('Could not find GTL report', 'report');
    }
    return report;
  }

  private privilegesFor(report: GTLReport) {
    return this.privileges.for(
      GtlProgressExplanation,
      contextOf<GtlProgressExplanation>(report),
    );
  }
}
