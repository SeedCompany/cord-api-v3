import { ConstraintViolationError, GelError } from 'gel';
import { jestSkipFileInExceptionSource } from '../../exception';
import { enhanceConstraintError } from './constraint-violation.error';

export const cleanError = (e: Error) => {
  // Ignore tracing & our Gel service wrappers in the stack trace.
  // This puts the actual query as the first.
  e.stack = e.stack!.replaceAll(/^\s+at .+\/(gel|tracing)\.service.+$\n/gm, '');

  // Don't present abstract repositories as the src block in jest reports
  // for DB execution errors.
  // There shouldn't be anything specific to there to be helpful.
  // This is a bit of a broad assumption, though, so only do for jest and
  // keep the frame for actual use from users/devs.
  if (e instanceof GelError) {
    jestSkipFileInExceptionSource(
      e,
      /^\s+at .+src[/|\\]core[/|\\]gel[/|\\].+\.repository\..+$\n/gm,
    );
  }

  if (e instanceof ConstraintViolationError) {
    return enhanceConstraintError(e);
  }
  return e;
};
