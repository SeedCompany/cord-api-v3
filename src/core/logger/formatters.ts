import { yellow, red, enabled as colorsEnabled } from 'colors/safe';
import { identity, mapValues } from 'lodash';
import { DateTime } from 'luxon';
import { relative } from 'path';
import { parse as parseTrace } from 'stack-trace';
import { MESSAGE } from 'triple-beam';
import { inspect } from 'util';
import { format } from 'winston';

export const metadata = () =>
  format.metadata({
    fillExcept: ['level', 'message', 'name', 'exception'],
  });

export const maskSecrets = () =>
  format(info => {
    info.metadata = mapValues(info.metadata, (val: string, key) =>
      /(password|token|key)/i.exec(key)
        ? `${'*'.repeat(val.slice(0, -3).length) + val.slice(-3)}`
        : val,
    );
    return info;
  })();

export const timestamp = format(info => {
  info.timestamp = DateTime.local().toLocaleString(
    DateTime.DATETIME_SHORT_WITH_SECONDS,
  );
  return info;
});

export const pid = format(info => {
  info.pid = process.pid;
  return info;
});

export const colorize = () =>
  colorsEnabled ? format.colorize({ message: true }) : format(identity)();

export const exceptionInfo = () =>
  format(info => {
    if (!info.exception) {
      return info;
    }

    const stack =
      info.exception instanceof Error ? info.exception.stack : info.stack;

    const type = stack.slice(0, info.stack.indexOf(':'));
    const trace = parseTrace({ stack } as Error);

    info.exception = {
      type,
      message: info.message,
      stack,
      trace,
    };
    delete info.stack;

    return info;
  })();

export const formatException = () =>
  format(info => {
    if (!info.exception) {
      return info;
    }
    const ex = info.exception;

    const formattedTrace = ex.trace
      .map(t => {
        const subject = t.getFunctionName();

        const file = relative(`${__dirname}/../../..`, t.getFileName());
        const location = file.startsWith('internal')
          ? ''
          : `${file}:${t.getLineNumber()}:${t.getColumnNumber()}`;

        return (
          red(`    at`) +
          (subject ? ' ' + subject : '') +
          (subject && location ? red(` (${location})`) : red(` ${location}`))
        );
      })
      .join('\n');

    info[MESSAGE] = red(`\n${ex.type}: ${ex.message}\n\n`) + formattedTrace;

    return info;
  })();

export const printForCli = () =>
  format.printf(info => {
    if (info[MESSAGE]) {
      return info[MESSAGE];
    }

    let msg = '';
    // msg += green(`[Nest] ${info.pid}   - `);
    // msg += `${info.timestamp}   `;
    msg += info.name ? yellow(`[${info.name}] `) : '';
    msg += info.message;
    msg += ` ${yellow(info.ms)}`;
    msg +=
      Object.keys(info.metadata).length > 0
        ? ` ${inspect(info.metadata, {
            depth: 2, // 2 default
            colors: colorsEnabled,
          })}`
        : '';
    return msg;
  });
