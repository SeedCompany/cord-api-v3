import { Session, UnsecuredDto } from '../../../common';
import { IEventBus } from '../../../core';
import { PeriodicReport } from '../dto';

/**
 * Called when a PeriodicReport needs to be secured.
 *
 * An event handler should handle this by setting {@see secured} property.
 */
export class SecurePeriodicReportEvent {
  secured?: PeriodicReport;

  constructor(
    readonly report: UnsecuredDto<PeriodicReport>,
    readonly session: Session
  ) {}

  static async run(
    bus: IEventBus,
    report: UnsecuredDto<PeriodicReport>,
    session: Session
  ) {
    const event = new SecurePeriodicReportEvent(report, session);
    await bus.publish(event);
    return event.secured;
  }
}
