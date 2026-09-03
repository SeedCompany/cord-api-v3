import { collectFields } from '@graphql-tools/utils';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import {
  type ExecutionArgs,
  type FragmentDefinitionNode,
  getOperationAST,
  GraphQLError,
  Kind,
  type OperationDefinitionNode,
} from 'graphql';
import { ReadOnlyModeException } from '~/common';
import { ConfigService } from '~/core/config';
import { ILogger, Logger } from '~/core/logger';
import { Plugin } from './plugin.decorator';

/**
 * Refuses every mutation while the API is in read-only maintenance mode
 * ({@link ConfigService.maintenance}), so the app stays up for reading while
 * the data underneath is frozen — i.e. while the cutover ETL copies the
 * database.
 *
 * Signing in & out stays available: sessions are deliberately outside the
 * freeze (they are excluded from the cutover and do not survive it), and
 * people need to sign in before they can read anything.
 *
 * Both transports funnel through here — HTTP requests and WebSocket
 * operations share the same envelop execute pipeline.
 */
@Plugin()
@Injectable()
export class ReadOnlyModePlugin implements OnModuleInit {
  /**
   * Mutations that only touch session state, which is not part of the freeze.
   * Password mutations are NOT here on purpose: they write real user data,
   * which would be silently lost when the frozen source is replaced.
   */
  static readonly sessionOnlyMutations: ReadonlySet<string> = new Set([
    'login',
    'logout',
  ]);

  @Logger('graphql:read-only-mode') private readonly logger: ILogger;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.maintenance.readOnly) {
      this.logger.warning(
        'Read-only maintenance mode is ON — refusing every mutation except login/logout',
      );
    }
  }

  onExecute: Plugin['onExecute'] = ({ args, setExecuteFn }) => {
    if (!this.config.maintenance.readOnly) {
      return;
    }
    const operation = getOperationAST(args.document, args.operationName);
    if (operation?.operation !== 'mutation') {
      return;
    }
    const fields = executedRootFields(args, operation);
    if (
      fields.every((field) =>
        ReadOnlyModePlugin.sessionOnlyMutations.has(field),
      )
    ) {
      return;
    }
    setExecuteFn(() => {
      const exception = new ReadOnlyModeException();
      return {
        errors: [
          new GraphQLError(exception.message, { originalError: exception }),
        ],
      };
    });
  };
}

/**
 * The root field names the operation will actually execute.
 *
 * `collectFields` is the executor's own field collection: it flattens
 * fragment spreads / inline fragments and honors `@skip`/`@include`, so a
 * write field disabled by a directive doesn't count against the operation
 * (a login mixed with a skipped write stays a login). `@defer`red selections
 * still execute — just delivered later — so their fields count too.
 * Meta fields (`__typename`) read the schema, not data, and are dropped.
 */
const executedRootFields = (
  args: Pick<ExecutionArgs, 'schema' | 'document' | 'variableValues'>,
  operation: OperationDefinitionNode,
): string[] => {
  const mutationType = args.schema.getMutationType();
  if (!mutationType) {
    // Unreachable for an executing mutation; judge nothing rather than crash.
    return [];
  }
  const fragments = Object.fromEntries(
    args.document.definitions
      .filter(
        (def): def is FragmentDefinitionNode =>
          def.kind === Kind.FRAGMENT_DEFINITION,
      )
      .map((fragment) => [fragment.name.value, fragment]),
  );
  const { fields, patches } = collectFields(
    args.schema,
    fragments,
    args.variableValues ?? {},
    mutationType,
    operation.selectionSet,
  );
  return [fields, ...patches.map((patch) => patch.fields)]
    .flatMap((fieldMap) => [...fieldMap.values()].flat())
    .map((field) => field.name.value)
    .filter((name) => !name.startsWith('__'));
};
