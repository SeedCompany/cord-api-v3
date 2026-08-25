import { Injectable } from '@nestjs/common';
import { Settings } from 'luxon';
import { DateInterval, type UnsecuredDto } from '~/common';
import { OnHook } from '~/core/hooks';
import { ILogger, Logger } from '~/core/logger';
import { EngagementService } from '../../engagement';
import { type Engagement, engagementRange } from '../../engagement/dto';
import {
  EngagementCreatedHook,
  EngagementUpdatedHook,
} from '../../engagement/hooks';
import { PeriodicReportService } from '../../periodic-report';
import { ReportType } from '../../periodic-report/dto';
import {
  AbstractPeriodicReportSync,
  type Intervals,
} from '../../periodic-report/handlers/abstract-periodic-report-sync';
import { ProjectUpdatedHook } from '../../project/hooks';

/**
 * Generates one GTL report per fiscal quarter from an Internship engagement's
 * date range, and removes them again when the range shrinks.
 *
 * A deliberate near-copy of `SyncProgressReportToEngagementDateRange` rather
 * than a widening of it: loosening that handler's Language gate would
 * retro-generate Momentum ProgressReports across every internship in the
 * system, which is exactly the Sept-2024 mistake that was cleaned up. Two
 * handlers with one shared base is the cheaper mistake.
 */
@Injectable()
export class SyncGtlReportToEngagementDateRange extends AbstractPeriodicReportSync {
  constructor(
    periodicReports: PeriodicReportService,
    private readonly engagements: EngagementService,
    @Logger('gtl-report:engagement-sync') private readonly logger: ILogger,
  ) {
    super(periodicReports);
  }

  @OnHook(EngagementCreatedHook)
  @OnHook(EngagementUpdatedHook)
  @OnHook(ProjectUpdatedHook)
  async handle(
    event: EngagementCreatedHook | EngagementUpdatedHook | ProjectUpdatedHook,
  ) {
    // Only InternshipEngagements — GTL is the program's name for them.
    if (
      !(
        ((event instanceof EngagementCreatedHook ||
          event instanceof EngagementUpdatedHook) &&
          event.isInternshipEngagement()) ||
        (event instanceof ProjectUpdatedHook &&
          event.updated.type === 'Internship')
      )
    ) {
      return;
    }

    if (
      event instanceof ProjectUpdatedHook &&
      event.changes.mouStart === undefined &&
      event.changes.mouEnd === undefined
    ) {
      // Project dates haven't changed, so do nothing.
      return;
    }
    if (
      event instanceof EngagementUpdatedHook &&
      event.input.startDateOverride === undefined &&
      event.input.endDateOverride === undefined
    ) {
      // Engagement dates haven't changed, so do nothing.
      return;
    }

    if (
      (event instanceof EngagementCreatedHook && event.engagement.changeset) ||
      (event instanceof EngagementUpdatedHook && event.updated.changeset)
    ) {
      // Reports are not changeset aware yet. Skip until the changeset is
      // approved and another update event fires.
      return;
    }

    this.logger.debug('Engagement mutation, syncing GTL reports', {
      ...event,
      event: event.constructor.name,
    });

    const engagements =
      event instanceof ProjectUpdatedHook
        ? await this.engagements.listAllByProjectId(event.updated.id)
        : event instanceof EngagementUpdatedHook
          ? [event.updated]
          : [event.engagement];

    for (const engagement of engagements) {
      // A project-level event fans out to every engagement under it, including
      // any language ones if the project type were ever mixed. The typename
      // carries Gel's `default::` prefix — see `resolveEngagementType`.
      if (engagement.__typename !== 'default::InternshipEngagement') {
        continue;
      }

      Settings.throwOnInvalid = false;
      const [updated, prev] =
        event instanceof ProjectUpdatedHook
          ? this.intervalsFromProjectChange(engagement, event)
          : event instanceof EngagementCreatedHook
            ? [engagementRange(event.engagement), null]
            : [
                engagementRange(event.updated), //
                engagementRange(event.previous),
              ];
      Settings.throwOnInvalid = true;

      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (prev && !prev.isValid) {
        this.logger.error('Found invalid date range for event', {
          eventType: event.constructor.name,
          diffSide: 'before',
          event,
        });
        throw new Error('Invalid engagement date range');
      }
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (updated && !updated.isValid) {
        this.logger.error('Found invalid date range for event', {
          eventType: event.constructor.name,
          diffSide: 'after',
          event,
        });
        throw new Error('Invalid engagement date range');
      }

      const diff = this.diffBy(updated, prev, 'quarter');

      await this.sync(
        engagement.id,
        ReportType.GTL,
        diff,
        engagement.endDate?.endOf('quarter'),
      );
    }
  }

  private intervalsFromProjectChange(
    engagement: UnsecuredDto<Engagement>,
    event: ProjectUpdatedHook,
  ): Intervals {
    return [
      // Engagement already has all the updated values calculated correctly.
      engagementRange(engagement),
      // For previous, there's no change if there was an override,
      // otherwise it's the project's previous
      DateInterval.tryFrom(
        engagement.startDateOverride ?? event.previous.mouStart,
        engagement.endDateOverride ?? event.previous.mouEnd,
      ),
    ];
  }
}
