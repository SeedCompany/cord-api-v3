import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  type ID,
  InputException,
  type RichTextDocument,
  UnauthorizedException,
} from '~/common';
import { Identity } from '~/core/authentication';
import { GtlReportWorkflowRepository } from './gtl-report-workflow.repository';
import { GtlTransitions, transitionsFrom } from './transitions';

@Injectable()
export class GtlReportWorkflowService {
  constructor(
    private readonly repo: GtlReportWorkflowRepository,
    private readonly identity: Identity,
  ) {}

  private get myRoles(): ReadonlySet<string> {
    return this.identity.current.roles;
  }

  private canExecute(roles: readonly string[]) {
    // Administrators bypass the per-transition role list, matching how
    // AdministratorPolicy grants everything elsewhere.
    if (this.myRoles.has('Administrator')) return true;
    return roles.some((r) => this.myRoles.has(r));
  }

  /** The transitions available from the report's current state, for this user. */
  async available(reportId: ID) {
    const status = await this.repo.currentStatus(reportId);
    if (!status) return [];
    return transitionsFrom(status).map((t) => ({
      key: t.id,
      label: t.label,
      to: t.to,
      type: t.type,
      canExecute: this.canExecute(t.roles as readonly string[]),
    }));
  }

  async history(reportId: ID) {
    const rows = await this.repo.history(reportId);
    return rows.map((row) => ({
      id: row.id,
      to: row.status,
      transition: row.transitionKey as ID | null,
      at: DateTime.fromJSDate(row.at),
      notes: row.notes ?? null,
      who: row.who,
    }));
  }

  async execute(input: {
    report: ID;
    transition: ID;
    notes?: RichTextDocument | null;
  }) {
    const transition = Object.values(GtlTransitions).find(
      (t) => t.id === input.transition,
    );
    if (!transition) {
      throw new InputException('Unknown transition', 'transition');
    }

    const status = await this.repo.currentStatus(input.report);
    if (!status) {
      throw new InputException('Report is not a GTL report', 'report');
    }
    if (!transition.from.includes(status)) {
      throw new InputException(
        `Cannot "${transition.label}" from ${status}`,
        'transition',
      );
    }
    if (!this.canExecute(transition.roles as readonly string[])) {
      throw new UnauthorizedException(
        `You do not have permission to "${transition.label}"`,
      );
    }

    await this.repo.execute({
      reportId: input.report,
      to: transition.to,
      transitionKey: transition.id,
      who: this.identity.current.userId,
      notes: input.notes,
    });
    return transition.to;
  }
}
