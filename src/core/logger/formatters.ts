import { ppRaw as prettyPrint } from '@patarapolw/prettyprint';
import { enabled as colorsEnabled, red, yellow } from 'colors/safe';
import { identity, mapValues } from 'lodash';
import { DateTime } from 'luxon';
import { relative } from 'path';
import { parse as parseTrace, StackFrame } from 'stack-trace';
import { MESSAGE } from 'triple-beam';
import { config, format } from 'winston';

export const metadata = () =>
  format.metadata({
    fillExcept: ['level', 'message', 'name', 'exception'],
  });

export const maskSecrets = () =>
  format((info) => {
    info.metadata = mapValues(info.metadata, (val: string, key) =>
      /(password|token|key)/i.exec(key)
        ? `${'*'.repeat(Math.min(val.slice(0, -3).length, 20)) + val.slice(-3)}`
        : val
    );
    return info;
  })();

export const timestamp = format((info) => {
  info.timestamp = DateTime.local().toLocaleString(
    DateTime.DATETIME_SHORT_WITH_SECONDS
  );
  return info;
});

export const pid = format((info) => {
  info.pid = process.pid;
  return info;
});

export const colorize = () =>
  colorsEnabled
    ? format.colorize({
        message: true,
        colors: {
          warning: 'yellow',
          alert: 'red',
        },
      })
    : format(identity)();

export const exceptionInfo = () =>
  format((info) => {
    if (!info.exception) {
      return info;
    }

    const stack =
      info.exception instanceof Error ? info.exception.stack : info.stack;

    const type = stack.slice(0, stack.indexOf(':'));
    const trace = parseTrace({ stack } as any);

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
  format((info) => {
    if (!info.exception) {
      return info;
    }
    const ex = info.exception;

    const formattedTrace = ex.trace
      .map((t: StackFrame) => {
        const subject = t.getFunctionName();

        const absolute: string | null = t.getFileName();
        const file = absolute
          ? relative(`${__dirname}/../../..`, absolute)
          : '';
        const location =
          !file || file.startsWith('internal')
            ? ''
            : `${file}:${t.getLineNumber()}:${t.getColumnNumber()}`;

        return (
          red(`    at`) +
          (subject ? ' ' + subject : '') +
          (subject && location ? red(` (${location})`) : red(` ${location}`))
        );
      })
      .join('\n');

    const bad = config.syslog.levels[info.level] > config.syslog.levels.warning;
    let msg = `${ex.type}: ${ex.message}\n`;
    msg = bad ? red(`\n${msg}\n`) : yellow(msg);
    info[MESSAGE] = `${msg}${formattedTrace}`;

    return info;
  })();

export const printForCli = () =>
  format.printf((info) => {
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
        ? ` ${prettyPrint(info.metadata, {
            depth: 2, // 2 default
            colors: colorsEnabled,
          })}`
        : '';
    return msg;
  });
