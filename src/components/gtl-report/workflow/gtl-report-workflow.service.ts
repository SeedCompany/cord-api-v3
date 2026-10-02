import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import {
  type ID,
  type MaybeSecured,
  NotFoundException,
  type UnsecuredDto,
  unwrapSecured,
} from '~/common';
import { Hooks } from '~/core/hooks';
import { ResourceMutatedHook } from '../../audit/resource-mutated.hook';
import { PeriodicReportService } from '../../periodic-report';
import {
  findTransition,
  WorkflowService,
} from '../../workflow/workflow.service';
import { type GTLReport } from '../dto';
import {
  type ExecuteGtlReportTransition,
  GtlReportWorkflowEvent as WorkflowEvent,
} from './dto';
import { GtlReportWorkflow } from './gtl-report-workflow';
import { GtlReportWorkflowRepository } from './gtl-report-workflow.repository';
import { GtlReportTransitionedHook } from './hooks/gtl-report-transitioned.hook';

@Injectable()
export class GtlReportWorkflowService extends WorkflowService(
  () => GtlReportWorkflow,
) {
  constructor(
    @Inject(forwardRef(() => PeriodicReportService))
    private readonly reports: PeriodicReportService & {},
    private readonly repo: GtlReportWorkflowRepository,
    private readonly hooks: Hooks,
    private readonly moduleRef: ModuleRef,
  ) {
    super();
  }

  async list(report: GTLReport): Promise<WorkflowEvent[]> {
    const dtos = await this.repo.list(report.id);
    return dtos.map((dto) => this.secure(dto));
  }

  async readMany(ids: readonly ID[]) {
    const dtos = await this.repo.readMany(ids);
    return dtos.map((dto) => this.secure(dto));
  }

  secure(dto: UnsecuredDto<WorkflowEvent>): WorkflowEvent {
    // The member-conditioned read on `who` and `notes` resolves against the
    // `scope` the repository attached; without it both come back unreadable
    // for the very members the grant is for.
    return {
      ...this.privileges.for(WorkflowEvent).secure(dto),
      transition: this.transitionByKey(dto.transition, dto.to),
    };
  }

  async getAvailableTransitions(report: MaybeSecured<GTLReport>) {
    return await this.resolveAvailable(
      unwrapSecured(report.status)!,
      { report, moduleRef: this.moduleRef },
      // The privilege context: the report's own `scope` and `sensitivity` are
      // what the member / sensitivity conditions on the event grants read.
      { ...report, report },
    );
  }

  async executeTransition(input: ExecuteGtlReportTransition) {
    const { report: reportId, notes } = input;

    const previous = await this.readUnsecured(reportId);

    const next =
      this.getBypassIfValid(input) ??
      findTransition(
        await this.getAvailableTransitions(previous),
        input.transition,
      );
    const to = typeof next !== 'string' ? next.to : next;

    const unsecuredEvent = await this.repo.recordEvent(previous, {
      to,
      transition: typeof next !== 'string' ? next.key : null,
      notes,
    });
    await this.repo.changeStatus(reportId, to);

    const updated = await this.readUnsecured(reportId);

    await this.hooks.run(
      new GtlReportTransitionedHook(
        updated,
        previous.status,
        next,
        unsecuredEvent,
      ),
    );

    // A user-driven change to the report, audited as an Update with the new
    // status — the same shape the Progress Report workflow records.
    await this.hooks.run(
      new ResourceMutatedHook('GTLReport', reportId, 'Update', {
        status: to,
        previousStatus: previous.status,
      }),
    );

    return unsecuredEvent;
  }

  /**
   * The report as stored. Progress and GTL rows share one table and one
   * lookup, so a Progress report's id is answered as "not found" here rather
   * than run through the wrong workflow.
   */
  private async readUnsecured(id: ID): Promise<UnsecuredDto<GTLReport>> {
    const report = await this.reports.readOneUnsecured(id);
    if (report.type !== 'GTL') {
      throw new NotFoundException('Could not find GTL report', 'report');
    }
    return report as UnsecuredDto<GTLReport>;
  }
}
