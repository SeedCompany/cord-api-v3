import { ppRaw as prettyPrint } from '@patarapolw/prettyprint';
import { enabled as colorsEnabled, red, yellow } from 'colors/safe';
import stringify from 'fast-safe-stringify';
import { identity } from 'lodash';
import { TransformableInfo as ScuffedTransformableInfo } from 'logform';
import { DateTime } from 'luxon';
import { relative } from 'path';
import { StackFrame } from 'stack-trace';
import * as stacktrace from 'stack-trace';
import { MESSAGE } from 'triple-beam';
import { config, format, LogEntry } from 'winston';
import { Exception } from '../../common/exceptions';
import { maskSecrets as maskSecretsOfObj } from '../../common/mask-secrets';
import { getNameFromEntry } from './logger.interface';

export const AFTER_MESSAGE = Symbol('AFTER_MESSAGE');

type TransformableInfo = ScuffedTransformableInfo & {
  [MESSAGE]?: string;
  [AFTER_MESSAGE]?: string;
};

type Color = (str: string) => string;

interface ParsedError {
  type: string;
  message: string;
  stack: string;
  trace: StackFrame[];
  other: Record<string, any>;
}

export const metadata = () =>
  format.metadata({
    fillExcept: ['level', 'message', 'exceptions'],
  });

export const maskSecrets = () =>
  format((info) => {
    info.metadata = maskSecretsOfObj(info.metadata);
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

    info.exceptions = flatten(info.exception).map((ex): ParsedError => {
      const { name: _, message, stack: __, ...other } = ex;
      const stack = ex.stack!;
      const type = ex.constructor.name || stack.slice(0, stack.indexOf(':'));
      const trace = stacktrace.parse({ stack } as any);

      return {
        type,
        message,
        stack,
        trace,
        other,
      };
    });
    delete info.exception;

    return info;
  })();

const formatMessage = (
  type: string,
  message: string,
  other: Record<string, any>,
  color: Color,
  extraSpace: boolean
) => {
  const otherStr = printObj(other);
  let msg = `${type}: ${message}\n`;
  msg = color(msg);
  msg += otherStr ? otherStr + '\n' : '';
  msg = extraSpace ? `\n${msg}\n` : msg;
  return msg;
};

const formatStackFrame = (t: StackFrame) => {
  const subject = t.getFunctionName();

  const absolute: string | null = t.getFileName();
  if (
    !absolute ||
    absolute.includes('node_modules') ||
    absolute.startsWith('internal/') ||
    absolute.startsWith('node:') ||
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
  format((info: TransformableInfo) => {
    if (!info.exceptions) {
      return info;
    }
    const exs: ParsedError[] = info.exceptions;

    const bad = config.syslog.levels[info.level] < config.syslog.levels.warning;

    info[MESSAGE] = exs
      .map((ex, index) => {
        const formattedMessage =
          (index > 0 ? 'Caused by: ' : '') +
          formatMessage(
            ex.type,
            ex.message,
            ex.other,
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
  format.printf((info: TransformableInfo) => {
    if (info[MESSAGE]) {
      return info[MESSAGE]!;
    }

    const name = getNameFromEntry(info);

    let msg = '';
    // msg += green(`[Nest] ${info.pid}   - `);
    // msg += `${info.timestamp}   `;
    msg += typeof name === 'string' ? yellow(`[${name}] `) : '';
    msg += info.message;
    msg += ` ${yellow(info.ms)}`;
    msg += printObj(info.metadata);
    if (info[AFTER_MESSAGE]) {
      msg += `\n${info[AFTER_MESSAGE]!}\n`;
    }

    return msg;
  });

const printObj = (obj: Record<string, any>) =>
  Object.keys(obj).length > 0
    ? ` ${prettyPrint(obj, {
        depth: 2, // 2 default
        colors: colorsEnabled,
      })}`
    : '';

export const printForJson = () =>
  format.printf((info: LogEntry & { exceptions?: ParsedError[] }) => {
    const { level, message, exceptions, metadata } = info;

    const obj = {
      logger: getNameFromEntry(info),
      level,
      message,
      exceptions: exceptions?.map(({ message, type, stack, other }) => ({
        type,
        message,
        ...other,
        stack,
      })),
      ...metadata,
    };
    return stringify(obj);
  });
