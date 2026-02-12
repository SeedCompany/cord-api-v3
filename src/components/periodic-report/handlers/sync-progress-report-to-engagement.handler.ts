import { Injectable } from '@nestjs/common';
import { Settings } from 'luxon';
import { DateInterval, type UnsecuredDto } from '~/common';
import { ILogger, Logger } from '~/core';
import { OnHook } from '~/core/hooks';
import { EngagementService } from '../../engagement';
import { type Engagement, engagementRange } from '../../engagement/dto';
import {
  EngagementCreatedHook,
  EngagementUpdatedHook,
} from '../../engagement/hooks';
import { ProjectUpdatedHook } from '../../project/hooks';
import { ReportType } from '../dto';
import { PeriodicReportService } from '../periodic-report.service';
import {
  AbstractPeriodicReportSync,
  type Intervals,
} from './abstract-periodic-report-sync';

@Injectable()
export class SyncProgressReportToEngagementDateRange extends AbstractPeriodicReportSync {
  constructor(
    periodicReports: PeriodicReportService,
    private readonly engagements: EngagementService,
    @Logger('progress-report:engagement-sync') private readonly logger: ILogger,
  ) {
    super(periodicReports);
  }

  @OnHook(EngagementCreatedHook)
  @OnHook(EngagementUpdatedHook)
  @OnHook(ProjectUpdatedHook)
  async handle(
    event: EngagementCreatedHook | EngagementUpdatedHook | ProjectUpdatedHook,
  ) {
    // Only LanguageEngagements
    if (
      !(
        ((event instanceof EngagementCreatedHook ||
          event instanceof EngagementUpdatedHook) &&
          event.isLanguageEngagement()) ||
        (event instanceof ProjectUpdatedHook &&
          event.updated.type.includes('Translation'))
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
      // Progress reports are not changeset aware yet. Skip processing this
      // until changeset is approved and another update event is fired.
      return;
    }

    this.logger.debug('Engagement mutation, syncing progress reports', {
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
      // I turned off throw on invalid above for this, so it is necessary despite the type inconsistency
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
        ReportType.Progress,
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
