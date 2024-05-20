import { clc } from '@nestjs/common/utils/cli-colors.util.js';
import { ppRaw as prettyPrint } from '@patarapolw/prettyprint';
import stringify from 'fast-safe-stringify';
import addIndent from 'indent-string';
import { identity } from 'lodash';
import { TransformableInfo as ScuffedTransformableInfo } from 'logform';
import { DateTime } from 'luxon';
import { dirname, relative } from 'path';
import { StackFrame } from 'stack-trace';
import * as stacktrace from 'stack-trace';
import { MESSAGE } from 'triple-beam';
import { fileURLToPath } from 'url';
import { config, format, LogEntry } from 'winston';
import { getCauseList } from '~/common';
import { maskSecrets as maskSecretsOfObj } from '~/common/mask-secrets';
import { getNameFromEntry } from './logger.interface';

const colorsEnabled = !process.env.NO_COLOR;
const { red, yellow } = clc;

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
    DateTime.DATETIME_SHORT_WITH_SECONDS,
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

    info.exceptions = getCauseList(info.exception).map((ex): ParsedError => {
      const { name: _, message, stack: __, ...other } = ex;
      const stack = ex.stack!;
      const type = ex.constructor.name || stack.slice(0, stack.indexOf(':'));
      const trace = stacktrace.parse({ stack } as any);

      return {
        type,
        message,
        stack,
        trace,
        other: {
          ...other,
          ...(ex instanceof AggregateError
            ? {
                errors: ex.errors.map((e) => ({ stack: e.stack, ...e })),
              }
            : {}),
        },
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
  extraSpace: boolean,
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

  // Sometimes its prefixed with file:// other times not.
  const file = relative(projectDir, absolute.replace(/^file:\/\//, ''));
  const location = `${file}:${t.getLineNumber()}:${t.getColumnNumber()}`;

  return (
    red(`    at`) +
    (subject ? ' ' + subject : '') +
    (subject && location ? red(` (${location})`) : red(` ${location}`))
  );
};

const projectDir = `${dirname(fileURLToPath(import.meta.url))}/../../..`;

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
          (index > 0 ? '[cause]: ' : '') +
          formatMessage(
            ex.type,
            ex.message,
            ex.other,
            bad ? red : yellow,
            bad && index === 0,
          );
        const formattedTrace = ex.trace
          .map(formatStackFrame)
          .filter(identity)
          .join('\n');
        return addIndent(formattedMessage + formattedTrace, index * 2);
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
    msg += info.message as string;
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
        depth: 3, // 2 default
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
        // Only include stack if it includes trace.
        // Otherwise, the type and message have already been given.
        stack: stack.includes('    at ') ? stack : undefined,
      })),
      ...metadata,
    };
    return stringify(obj);
  });
