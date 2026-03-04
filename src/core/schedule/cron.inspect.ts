import { setInspectOnClass } from '@seedcompany/common';
import { Cron } from 'croner';
import { DateTime } from 'luxon';

setInspectOnClass(Cron, (cron) => (args) => {
  const { inspect, depth, showHidden, collapsed, stylize } = args;

  if (depth <= 0) {
    return collapsed(cron.name, 'Cron');
  }
  const state = (cron as any)._states;
  const info = {
    name: cron.name,
    ...(cron.getOnce()
      ? { once: DateTime.fromJSDate(cron.getOnce()!) }
      : { schedule: cron.getPattern() }),
    ...(cron.options.timezone && { timezone: cron.options.timezone }),
    paused: state.paused,
    maxRuns: state.maxRuns,
    busy: state.blocking,
    stopped: state.kill,
    options: cron.options,
    // eslint-disable-next-line @typescript-eslint/naming-convention
    ...(showHidden && { fn: (cron as any).fn, _states: state }),
  };
  return `${stylize('Cron', 'special')} ${inspect(info)}`;
});
