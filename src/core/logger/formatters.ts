import { ppRaw as prettyPrint } from '@patarapolw/prettyprint';
import { enabled as colorsEnabled, red, yellow } from 'colors/safe';
import { identity, mapValues } from 'lodash';
import { DateTime } from 'luxon';
import { relative } from 'path';
import { parse as parseTrace, StackFrame } from 'stack-trace';
import { MESSAGE } from 'triple-beam';
import { config, format } from 'winston';
import { Exception } from '../../common/exceptions';
import { getNameFromEntry } from './logger.interface';

type Color = (str: string) => string;

interface ParsedError {
  type: string;
  message: string;
  stack: string;
  trace: StackFrame[];
}

export const metadata = () =>
  format.metadata({
    fillExcept: ['level', 'message', 'exceptions'],
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
    if (!info.exception || !(info.exception instanceof Error)) {
      return info;
    }
    // stack should not be used. I think it's only NestJS so we should handle there.
    delete info.stack;

    const flatten = (ex: Error): Error[] =>
      ex instanceof Exception && ex.previous
        ? [ex, ...flatten(ex.previous)]
        : [ex];

    info.exceptions = flatten(info.exception).map(
      (ex): ParsedError => {
        const stack = ex.stack!;
        const type = stack.slice(0, stack.indexOf(':'));
        const trace = parseTrace({ stack } as any);

        return {
          type,
          message: ex.message,
          stack,
          trace,
        };
      }
    );

    return info;
  })();

const formatMessage = (
  type: string,
  message: string,
  color: Color,
  extraSpace: boolean
) => {
  let msg = `${type}: ${message}\n`;
  msg = extraSpace ? `\n${msg}\n` : msg;
  msg = color(msg);
  return msg;
};

const formatStackFrame = (t: StackFrame) => {
  const subject = t.getFunctionName();

  const absolute: string | null = t.getFileName();
  if (
    !absolute ||
    absolute.includes('node_modules') ||
    absolute.startsWith('internal/') ||
    absolute.includes('<anonymous>')
  ) {
    return null;
  }

  const file = relative(`${__dirname}/../../..`, absolute);
  const location = `${file}:${t.getLineNumber()}:${t.getColumnNumber()}`;

  return (
    red(`    at`) +
    (subject ? ' ' + subject : '') +
    (subject && location ? red(` (${location})`) : red(` ${location}`))
  );
};

export const formatException = () =>
  format((info) => {
    if (!info.exceptions) {
      return info;
    }
    const exs: ParsedError[] = info.exceptions;

    const bad = config.syslog.levels[info.level] > config.syslog.levels.warning;

    info[MESSAGE] = exs
      .map((ex, index) => {
        const formattedMessage =
          (index > 0 ? 'Caused by: ' : '') +
          formatMessage(
            ex.type,
            ex.message,
            bad ? red : yellow,
            bad && index === 0
          );
        const formattedTrace = ex.trace
          .map(formatStackFrame)
          .filter(identity)
          .join('\n');
        return formattedMessage + formattedTrace;
      })
      .join('\n');

    return info;
  })();

export const printForCli = () =>
  format.printf((info) => {
    if (info[MESSAGE]) {
      return info[MESSAGE];
    }

    const name = getNameFromEntry(info);

    let msg = '';
    // msg += green(`[Nest] ${info.pid}   - `);
    // msg += `${info.timestamp}   `;
    msg += typeof name === 'string' ? yellow(`[${name}] `) : '';
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
